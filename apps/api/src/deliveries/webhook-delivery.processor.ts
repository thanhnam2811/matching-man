import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { WebhookDeliveryService } from "./deliveries.service";

export interface WebhookDeliveryJobData {
    deliveryId: string;
}

@Processor("webhook-delivery")
export class WebhookDeliveryProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookDeliveryProcessor.name);

    constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {
        super();
    }

    async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
        try {
            await this.webhookDeliveryService.executeSingleDelivery(job.data.deliveryId);
        } catch (err) {
            this.logger.error(`Failed to process webhook delivery job for ${job.data.deliveryId}`, err);
            throw err;
        }
    }
}
