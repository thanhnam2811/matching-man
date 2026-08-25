import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { QueueTimeoutProcessor, QueueTimeoutJobData } from "./queue-timeout.processor";

describe("QueueTimeoutProcessor", () => {
    let processor: QueueTimeoutProcessor;
    let prismaService: {
        client: {
            $queryRaw: jest.Mock;
        };
    };
    let webhookDeliveryService: {
        scheduleDelivery: jest.Mock;
    };

    beforeEach(() => {
        prismaService = {
            client: {
                $queryRaw: jest.fn(),
            },
        };
        webhookDeliveryService = {
            scheduleDelivery: jest.fn().mockResolvedValue(undefined),
        };
        processor = new QueueTimeoutProcessor(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
        );
    });

    it("times out a queued entry atomically and schedules a queue.timeout webhook", async () => {
        const queuedAt = new Date("2026-06-12T00:00:00.000Z");
        prismaService.client.$queryRaw.mockResolvedValue([
            {
                id: "entry_1",
                project_id: "project_1",
                game_mode_id: "mode_1",
                environment: "production",
                region_key: "global",
                team_id: "team_1",
                queued_at: queuedAt,
            },
        ]);

        const job = {
            id: "timeout:entry_1",
            data: { queueEntryId: "entry_1", projectId: "project_1" },
        } as Job<QueueTimeoutJobData>;

        await processor.process(job);

        expect(prismaService.client.$queryRaw).toHaveBeenCalledTimes(1);
        expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
            "project_1",
            "queue.timeout",
            expect.objectContaining({
                event: "queue.timeout",
                queueEntryId: "entry_1",
                teamId: "team_1",
                gameModeId: "mode_1",
                environment: "production",
                regionKey: "global",
                queuedAt,
                timedOutAt: expect.any(Date),
            }),
        );
    });

    it("no-ops without scheduling a webhook if the entry is no longer QUEUED", async () => {
        prismaService.client.$queryRaw.mockResolvedValue([]);

        const job = {
            id: "timeout:entry_1",
            data: { queueEntryId: "entry_1", projectId: "project_1" },
        } as Job<QueueTimeoutJobData>;

        await processor.process(job);

        expect(prismaService.client.$queryRaw).toHaveBeenCalledTimes(1);
        expect(webhookDeliveryService.scheduleDelivery).not.toHaveBeenCalled();
    });

    it("rethrows database errors to allow BullMQ to handle retries", async () => {
        prismaService.client.$queryRaw.mockRejectedValue(new Error("db down"));

        const job = {
            id: "timeout:entry_1",
            data: { queueEntryId: "entry_1", projectId: "project_1" },
        } as Job<QueueTimeoutJobData>;

        await expect(processor.process(job)).rejects.toThrow("db down");
        expect(webhookDeliveryService.scheduleDelivery).not.toHaveBeenCalled();
    });
});
