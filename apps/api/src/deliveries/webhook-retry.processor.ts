import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { WebhookDeliveryService } from "./deliveries.service";

@Injectable()
export class WebhookRetryProcessor {
    private readonly logger = new Logger(WebhookRetryProcessor.name);

    constructor(
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {}

    @Cron("*/30 * * * * *")
    async processPendingDeliveries() {
        // Recorded unconditionally: liveness means the cron tick fired, not that
        // the underlying delivery batch succeeded (DB/network failures are a
        // separate concern, already visible via the `database` health check).
        this.schedulerHealthService.recordRun(SCHEDULER_JOBS.WEBHOOK_RETRY);

        try {
            await this.webhookDeliveryService.sendPendingDeliveries();
        } catch (err) {
            this.logger.error("Failed to process pending webhook deliveries", err);
        }
    }
}
