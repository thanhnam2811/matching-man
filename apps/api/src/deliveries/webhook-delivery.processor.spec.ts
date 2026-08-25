import { Job } from "bullmq";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { WebhookDeliveryService } from "./deliveries.service";

describe("WebhookDeliveryProcessor", () => {
    let processor: WebhookDeliveryProcessor;
    let service: {
        executeSingleDelivery: jest.Mock;
    };

    beforeEach(() => {
        service = {
            executeSingleDelivery: jest.fn().mockResolvedValue(undefined),
        };
        processor = new WebhookDeliveryProcessor(service as unknown as WebhookDeliveryService);
    });

    it("processes a webhook-delivery job by calling executeSingleDelivery with the deliveryId", async () => {
        const job = {
            id: "job_1",
            data: { deliveryId: "del_123" },
        } as unknown as Job<{ deliveryId: string }>;

        await processor.process(job);

        expect(service.executeSingleDelivery).toHaveBeenCalledWith("del_123");
        expect(service.executeSingleDelivery).toHaveBeenCalledTimes(1);
    });
});
