import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { WebhookDeliveryService } from "../src/deliveries/deliveries.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { WebhookDeliveryStatus } from "../src/generated/prisma/client";
import { buildTestApp } from "./support/build-app";
import { createMatchmakingFixture } from "./support/fixtures";

describe("Webhook delivery retry/backoff (e2e)", () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let deliveryService: WebhookDeliveryService;
    let fetchSpy: jest.SpyInstance;

    beforeAll(async () => {
        app = await buildTestApp();
        prisma = app.get(PrismaService);
        deliveryService = app.get(WebhookDeliveryService);
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        fetchSpy?.mockRestore();
    });

    async function setupPendingDelivery() {
        const http = app.getHttpServer() as Parameters<typeof request>[0];
        const fixture = await createMatchmakingFixture(app);

        await request(http)
            .post(`/v1/projects/${fixture.projectId}/webhooks`)
            .set("Authorization", `Bearer ${fixture.sessionToken}`)
            .send({ url: "https://example.test/unreachable-webhook", events: ["match.created"] })
            .expect(201);

        const enqueue = (playerId: string) =>
            request(http)
                .post("/v1/queues/enqueue")
                .set("Authorization", `Bearer ${fixture.apiKey}`)
                .send({
                    projectId: fixture.projectId,
                    gameModeId: fixture.gameModeId,
                    environment: "production",
                    team: { members: [{ playerId }] },
                })
                .expect(201);

        await enqueue("p1");
        await enqueue("p2");

        // Match-making now runs fire-and-forget after the enqueue response is sent,
        // so the webhook delivery is not created synchronously — poll for it.
        const deadline = Date.now() + 5000;

        while (Date.now() < deadline) {
            const delivery = await prisma.client.webhookDelivery.findFirst({
                where: { webhookEndpoint: { projectId: fixture.projectId } },
            });

            if (delivery) {
                return delivery.id;
            }

            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        throw new Error("Timed out waiting for match.created webhook delivery");
    }

    it("marks the delivery FAILED and schedules a ~30s retry after a connection failure", async () => {
        const deliveryId = await setupPendingDelivery();
        fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"));
        const before = Date.now();

        await deliveryService.sendPendingDeliveries();

        const delivery = await prisma.client.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
        expect(delivery.status).toBe(WebhookDeliveryStatus.FAILED);
        expect(delivery.attemptCount).toBe(1);
        expect(delivery.lastError).toBe("connect ECONNREFUSED");
        expect(delivery.nextRetryAt).not.toBeNull();
        const retryDelayMs = delivery.nextRetryAt!.getTime() - before;
        expect(retryDelayMs).toBeGreaterThan(25_000);
        expect(retryDelayMs).toBeLessThan(35_000);
    });

    it("widens the backoff window on the second consecutive failure (~5 minutes)", async () => {
        const deliveryId = await setupPendingDelivery();
        fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"));

        await deliveryService.sendPendingDeliveries();
        // Simulate the next cron tick finding this delivery due for retry.
        await prisma.client.webhookDelivery.update({ where: { id: deliveryId }, data: { nextRetryAt: new Date() } });
        const before = Date.now();

        await deliveryService.sendPendingDeliveries();

        const delivery = await prisma.client.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
        expect(delivery.attemptCount).toBe(2);
        expect(delivery.status).toBe(WebhookDeliveryStatus.FAILED);
        const retryDelayMs = delivery.nextRetryAt!.getTime() - before;
        expect(retryDelayMs).toBeGreaterThan(4 * 60_000);
        expect(retryDelayMs).toBeLessThan(6 * 60_000);
    });

    it("stops retrying once MAX_ATTEMPTS is exhausted, even if the endpoint later comes back up", async () => {
        const deliveryId = await setupPendingDelivery();

        // Fast-forward straight to the last allowed attempt instead of waiting through
        // the real 2h/30min backoff windows.
        await prisma.client.webhookDelivery.update({
            where: { id: deliveryId },
            data: { attemptCount: 4, nextRetryAt: new Date() },
        });
        fetchSpy = jest.spyOn(global, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED"));

        await deliveryService.sendPendingDeliveries();

        let delivery = await prisma.client.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
        expect(delivery.attemptCount).toBe(5);
        expect(delivery.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
        expect(delivery.nextRetryAt).toBeNull();
        expect(delivery.exhaustedAt).not.toBeNull();

        // Even though the endpoint is healthy again, sendPendingDeliveries only polls
        // PENDING/FAILED rows, so an EXHAUSTED delivery is never retried.
        fetchSpy.mockClear();
        fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
        await deliveryService.sendPendingDeliveries();

        expect(fetchSpy).not.toHaveBeenCalled();
        delivery = await prisma.client.webhookDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
        expect(delivery.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
    });
});
