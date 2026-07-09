import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { QueueEntryStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";

@Injectable()
export class QueueTimeoutProcessor {
    private readonly logger = new Logger(QueueTimeoutProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {}

    @Cron("0 * * * * *")
    async processTimedOutEntries() {
        this.schedulerHealthService.recordRun(SCHEDULER_JOBS.QUEUE_TIMEOUT);

        try {
            await this.scanAndTimeout();
        } catch (err) {
            this.logger.error("Failed to process queue timeouts", err);
        }
    }

    private async scanAndTimeout() {
        const now = new Date();
        const timedOutAt = now;

        // Single atomic UPDATE...RETURNING: the WHERE status = QUEUED guard is
        // evaluated against each row's current state as part of the update itself,
        // so an entry that a concurrent match-maker attempt matches (status ->
        // MATCHED) in the same window is correctly skipped here instead of being
        // overwritten back to TIMED_OUT. Also removes a round-trip versus the old
        // separate SELECT + updateMany, and only the rows actually transitioned
        // drive the webhook loop below (previously it fired for every row in the
        // initial SELECT regardless of whether the updateMany actually touched it).
        const timedOut = await this.prismaService.client.$queryRaw<
            Array<{
                id: string;
                project_id: string;
                game_mode_id: string;
                environment: string;
                region_key: string;
                team_id: string;
                queued_at: Date;
            }>
        >`
            UPDATE queue_entries qe
            SET status = ${QueueEntryStatus.TIMED_OUT}, timed_out_at = ${timedOutAt}
            FROM game_modes gm
            WHERE qe.game_mode_id = gm.id
              AND qe.status = ${QueueEntryStatus.QUEUED}
              AND qe.queued_at + (gm.max_queue_seconds * interval '1 second') < ${now}
            RETURNING qe.id, qe.project_id, qe.game_mode_id, qe.environment, qe.region_key, qe.team_id, qe.queued_at
        `;

        if (timedOut.length === 0) {
            return;
        }

        this.logger.log(`Timed out ${timedOut.length} queue entries`);

        await Promise.allSettled(
            timedOut.map((entry) =>
                this.webhookDeliveryService.scheduleDelivery(entry.project_id, "queue.timeout", {
                    event: "queue.timeout",
                    queueEntryId: entry.id,
                    teamId: entry.team_id,
                    gameModeId: entry.game_mode_id,
                    environment: entry.environment,
                    regionKey: entry.region_key,
                    queuedAt: entry.queued_at,
                    timedOutAt,
                }),
            ),
        );
    }
}
