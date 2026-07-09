import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { QueueTimeoutProcessor } from "./queue-timeout.processor";

describe("QueueTimeoutProcessor", () => {
    it("records a scheduler run even when the timeout scan throws", async () => {
        const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
        const prismaService = {
            client: { $queryRaw: jest.fn().mockRejectedValue(new Error("db down")) },
        } as unknown as PrismaService;
        const webhookDeliveryService = {} as unknown as WebhookDeliveryService;
        const processor = new QueueTimeoutProcessor(prismaService, webhookDeliveryService, schedulerHealthService);

        await processor.processTimedOutEntries();

        expect(schedulerHealthService.recordRun).toHaveBeenCalledWith(SCHEDULER_JOBS.QUEUE_TIMEOUT);
    });
});
