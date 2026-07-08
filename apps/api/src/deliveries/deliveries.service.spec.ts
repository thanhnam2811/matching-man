import { createHmac } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryStatus } from "../generated/prisma/client";
import { WebhookDeliveryService } from "./deliveries.service";

describe("WebhookDeliveryService", () => {
    let service: WebhookDeliveryService;
    let prismaService: {
        client: {
            webhookEndpoint: { findMany: jest.Mock };
            webhookDelivery: { createMany: jest.Mock; findMany: jest.Mock; update: jest.Mock; count: jest.Mock };
        };
    };
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        prismaService = {
            client: {
                webhookEndpoint: { findMany: jest.fn() },
                webhookDelivery: {
                    createMany: jest.fn(),
                    findMany: jest.fn(),
                    update: jest.fn(),
                    count: jest.fn(),
                },
            },
        };

        service = new WebhookDeliveryService(prismaService as unknown as PrismaService);
        fetchSpy = jest.spyOn(global, "fetch");
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        jest.useRealTimers();
    });

    describe("scheduleDelivery", () => {
        it("creates a pending delivery only for active endpoints subscribed to the event", async () => {
            prismaService.client.webhookEndpoint.findMany.mockResolvedValue([
                { id: "ep_subscribed", events: ["match.completed"] },
                { id: "ep_unsubscribed", events: ["rating.updated"] },
            ]);

            await service.scheduleDelivery("project_1", "match.completed", { matchId: "match_1" });

            expect(prismaService.client.webhookDelivery.createMany).toHaveBeenCalledWith({
                data: [
                    expect.objectContaining({
                        webhookEndpointId: "ep_subscribed",
                        eventType: "match.completed",
                        status: WebhookDeliveryStatus.PENDING,
                    }),
                ],
            });
        });

        it("skips creating deliveries when no endpoint is subscribed to the event", async () => {
            prismaService.client.webhookEndpoint.findMany.mockResolvedValue([
                { id: "ep_1", events: ["rating.updated"] },
            ]);

            await service.scheduleDelivery("project_1", "match.completed", {});

            expect(prismaService.client.webhookDelivery.createMany).not.toHaveBeenCalled();
        });
    });

    describe("HMAC signing", () => {
        it("signs the delivery with sha256=<hmac(timestamp.body, secret)> and a matching X-Webhook-Timestamp header", async () => {
            const secretHex = "aa".repeat(24);
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: { matchId: "match_1" },
                    attemptCount: 0,
                    webhookEndpoint: { url: "https://example.test/webhook", secret: `whsec_${secretHex}` },
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

            await service.sendPendingDeliveries();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            const headers = init.headers as Record<string, string>;

            expect(url).toBe("https://example.test/webhook");
            expect(headers["X-Webhook-Event"]).toBe("match.completed");

            const timestamp = headers["X-Webhook-Timestamp"];
            const body = init.body as string;
            const expectedSignature = createHmac("sha256", Buffer.from(secretHex, "hex"))
                .update(`${timestamp}.${body}`)
                .digest("hex");

            expect(headers["X-Webhook-Signature"]).toBe(`sha256=${expectedSignature}`);
        });

        it("produces a signature that changes when the secret differs (receiver-side verification would reject a forged one)", async () => {
            const bodyHex = "bb".repeat(24);
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: { matchId: "match_1" },
                    attemptCount: 0,
                    webhookEndpoint: { url: "https://example.test/webhook", secret: `whsec_${bodyHex}` },
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

            await service.sendPendingDeliveries();

            const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            const headers = init.headers as Record<string, string>;
            const timestamp = headers["X-Webhook-Timestamp"];
            const body = init.body as string;

            const signatureWithWrongSecret = createHmac("sha256", Buffer.from("cc".repeat(24), "hex"))
                .update(`${timestamp}.${body}`)
                .digest("hex");

            expect(headers["X-Webhook-Signature"]).not.toBe(`sha256=${signatureWithWrongSecret}`);
        });
    });

    describe("retry/backoff on delivery attempts", () => {
        const endpoint = { url: "https://example.test/webhook", secret: `whsec_${"aa".repeat(24)}` };

        it("marks a successful delivery as DELIVERED with no further retry", async () => {
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: {},
                    attemptCount: 0,
                    webhookEndpoint: endpoint,
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

            await service.sendPendingDeliveries();

            expect(prismaService.client.webhookDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "delivery_1" },
                    data: expect.objectContaining({
                        attemptCount: 1,
                        status: WebhookDeliveryStatus.DELIVERED,
                        nextRetryAt: null,
                        lastResponseCode: 200,
                        lastError: null,
                    }),
                }),
            );
        });

        it("schedules a retry 30s out after the first failed attempt", async () => {
            jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: {},
                    attemptCount: 0,
                    webhookEndpoint: endpoint,
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

            await service.sendPendingDeliveries();

            expect(prismaService.client.webhookDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        attemptCount: 1,
                        status: WebhookDeliveryStatus.FAILED,
                        nextRetryAt: new Date("2026-06-12T00:00:30.000Z"),
                        lastResponseCode: 500,
                        lastError: "HTTP 500",
                    }),
                }),
            );
        });

        it("schedules a retry 5 minutes out after the second failed attempt", async () => {
            jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: {},
                    attemptCount: 1,
                    webhookEndpoint: endpoint,
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

            await service.sendPendingDeliveries();

            expect(prismaService.client.webhookDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        attemptCount: 2,
                        status: WebhookDeliveryStatus.FAILED,
                        nextRetryAt: new Date("2026-06-12T00:05:00.000Z"),
                    }),
                }),
            );
        });

        it("marks the delivery EXHAUSTED with no further retry once MAX_ATTEMPTS is reached", async () => {
            jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: {},
                    attemptCount: 4,
                    webhookEndpoint: endpoint,
                },
            ]);
            fetchSpy.mockResolvedValue(new Response(null, { status: 500 }));

            await service.sendPendingDeliveries();

            expect(prismaService.client.webhookDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        attemptCount: 5,
                        status: WebhookDeliveryStatus.EXHAUSTED,
                        nextRetryAt: null,
                        exhaustedAt: new Date("2026-06-12T00:00:00.000Z"),
                    }),
                }),
            );
        });

        it("records the network error and still schedules a retry when fetch throws (e.g. connection refused)", async () => {
            jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
            prismaService.client.webhookDelivery.findMany.mockResolvedValue([
                {
                    id: "delivery_1",
                    eventType: "match.completed",
                    payload: {},
                    attemptCount: 0,
                    webhookEndpoint: endpoint,
                },
            ]);
            fetchSpy.mockRejectedValue(new Error("fetch failed"));

            await service.sendPendingDeliveries();

            expect(prismaService.client.webhookDelivery.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: WebhookDeliveryStatus.FAILED,
                        lastError: "fetch failed",
                        lastResponseCode: null,
                        nextRetryAt: new Date("2026-06-12T00:00:30.000Z"),
                    }),
                }),
            );
        });
    });
});
