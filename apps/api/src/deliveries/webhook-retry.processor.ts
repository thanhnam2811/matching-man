import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WebhookDeliveryService } from "./deliveries.service";

@Injectable()
export class WebhookRetryProcessor {
    private readonly logger = new Logger(WebhookRetryProcessor.name);

    constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {}

    @Cron("*/30 * * * * *")
    async processPendingDeliveries() {
        try {
            await this.webhookDeliveryService.sendPendingDeliveries();
        } catch (err) {
            this.logger.error("Failed to process pending webhook deliveries", err);
        }
    }
}
