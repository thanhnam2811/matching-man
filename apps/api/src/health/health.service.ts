import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";

// 3x each cron's own interval (webhook-retry: */30s, queue-timeout: 0 * * * * * = 60s).
const WEBHOOK_RETRY_STALE_AFTER_MS = 90_000;
const QUEUE_TIMEOUT_STALE_AFTER_MS = 180_000;

@Injectable()
export class HealthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {}

    async getHealth() {
        const database = await this.prismaService.isHealthy();
        const webhookRetry = this.schedulerHealthService.getStatus(
            SCHEDULER_JOBS.WEBHOOK_RETRY,
            WEBHOOK_RETRY_STALE_AFTER_MS,
        );
        const queueTimeout = this.schedulerHealthService.getStatus(
            SCHEDULER_JOBS.QUEUE_TIMEOUT,
            QUEUE_TIMEOUT_STALE_AFTER_MS,
        );
        // "pending" (never ticked yet, e.g. just after boot) is expected and not
        // itself a degradation signal — only a job that ran before and has since
        // gone stale ("down") counts.
        const schedulerOk = webhookRetry !== "down" && queueTimeout !== "down";

        return {
            status: database && schedulerOk ? "ok" : "degraded",
            checks: {
                database: database ? "up" : "down",
                scheduler: { webhookRetry, queueTimeout },
            },
            timestamp: new Date().toISOString(),
        };
    }
}
