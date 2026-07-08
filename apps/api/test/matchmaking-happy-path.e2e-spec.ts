import { createHmac, randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { WebhookDeliveryService } from "../src/deliveries/deliveries.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { WebhookDeliveryStatus } from "../src/generated/prisma/client";
import { buildTestApp } from "./support/build-app";
import { createMatchmakingFixture } from "./support/fixtures";

describe("Matchmaking happy path (e2e)", () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let fetchSpy: jest.SpyInstance;

    beforeAll(async () => {
        app = await buildTestApp();
        prisma = app.get(PrismaService);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    it("enqueues two players, forms a match, reports the result, and delivers signed webhooks", async () => {
        const http = app.getHttpServer() as Parameters<typeof request>[0];
        const fixture = await createMatchmakingFixture(app);

        const webhookRes = await request(http)
            .post(`/v1/projects/${fixture.projectId}/webhooks`)
            .set("Authorization", `Bearer ${fixture.sessionToken}`)
            .send({
                url: "https://example.test/webhook",
                events: ["match.created", "match.completed", "rating.updated"],
            })
            .expect(201);
        const webhookSecret = webhookRes.body.secret as string;

        const enqueue = (playerId: string) =>
            request(http)
                .post("/v1/queues/enqueue")
                .set("Authorization", `Bearer ${fixture.apiKey}`)
                .send({
                    projectId: fixture.projectId,
                    gameModeId: fixture.gameModeId,
                    environment: "production",
                    team: { members: [{ playerId }] },
                });

        const first = await enqueue(`p1-${randomUUID().slice(0, 8)}`).expect(201);
        expect(first.body.matchId).toBeNull();

        const second = await enqueue(`p2-${randomUUID().slice(0, 8)}`).expect(201);
        const matchId = second.body.matchId as string;
        expect(matchId).toEqual(expect.any(String));

        const reportRes = await request(http)
            .post(`/v1/matches/${matchId}/report-result`)
            .set("Authorization", `Bearer ${fixture.apiKey}`)
            .send({ winnerGroupIndex: 1, endedAt: new Date().toISOString() })
            .expect(201);
        expect(reportRes.body.status).toBe("completed");
        expect(reportRes.body.ratingUpdateStatus).toBe("completed");

        const deliveryService = app.get(WebhookDeliveryService);
        await deliveryService.sendPendingDeliveries();

        // match.created (from the 2nd enqueue), match.completed, and rating.updated.
        expect(fetchSpy).toHaveBeenCalledTimes(3);

        const eventsSent = fetchSpy.mock.calls.map(
            ([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers["X-Webhook-Event"],
        );
        expect(eventsSent.toSorted()).toEqual(["match.completed", "match.created", "rating.updated"]);

        for (const [, init] of fetchSpy.mock.calls) {
            const headers = (init as RequestInit).headers as Record<string, string>;
            const body = init!.body as string;
            const expectedSignature = createHmac("sha256", Buffer.from(webhookSecret.replace("whsec_", ""), "hex"))
                .update(`${headers["X-Webhook-Timestamp"]}.${body}`)
                .digest("hex");
            expect(headers["X-Webhook-Signature"]).toBe(`sha256=${expectedSignature}`);
        }

        const deliveries = await prisma.client.webhookDelivery.findMany({
            where: { webhookEndpoint: { projectId: fixture.projectId } },
        });
        expect(deliveries).toHaveLength(3);
        expect(deliveries.every((delivery) => delivery.status === WebhookDeliveryStatus.DELIVERED)).toBe(true);
    });
});
