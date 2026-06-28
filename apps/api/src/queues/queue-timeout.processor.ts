import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { QueueEntryStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";

@Injectable()
export class QueueTimeoutProcessor {
    private readonly logger = new Logger(QueueTimeoutProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
    ) {}

    @Cron("0 * * * * *")
    async processTimedOutEntries() {
        try {
            await this.scanAndTimeout();
        } catch (err) {
            this.logger.error("Failed to process queue timeouts", err);
        }
    }

    private async scanAndTimeout() {
        const now = new Date();

        // Find QUEUED entries where queuedAt + maxQueueSeconds < now
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
            SELECT qe.id, qe.project_id, qe.game_mode_id, qe.environment, qe.region_key, qe.team_id, qe.queued_at
            FROM queue_entries qe
            JOIN game_modes gm ON gm.id = qe.game_mode_id
            WHERE qe.status = ${QueueEntryStatus.QUEUED}
              AND qe.queued_at + (gm.max_queue_seconds * interval '1 second') < ${now}
        `;

        if (timedOut.length === 0) {
            return;
        }

        const timedOutAt = new Date();
        const ids = timedOut.map((e) => e.id);

        await this.prismaService.client.queueEntry.updateMany({
            where: { id: { in: ids } },
            data: { status: QueueEntryStatus.TIMED_OUT, timedOutAt },
        });

        this.logger.log(`Timed out ${ids.length} queue entries`);

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
