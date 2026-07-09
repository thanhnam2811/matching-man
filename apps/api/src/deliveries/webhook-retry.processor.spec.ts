import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { WebhookDeliveryService } from "./deliveries.service";
import { WebhookRetryProcessor } from "./webhook-retry.processor";

describe("WebhookRetryProcessor", () => {
    it("records a scheduler run even when sendPendingDeliveries throws", async () => {
        const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
        const webhookDeliveryService = {
            sendPendingDeliveries: jest.fn().mockRejectedValue(new Error("db down")),
        } as unknown as WebhookDeliveryService;
        const processor = new WebhookRetryProcessor(webhookDeliveryService, schedulerHealthService);

        await processor.processPendingDeliveries();

        expect(schedulerHealthService.recordRun).toHaveBeenCalledWith(SCHEDULER_JOBS.WEBHOOK_RETRY);
    });
});
