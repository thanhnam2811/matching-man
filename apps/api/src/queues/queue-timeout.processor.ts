import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { QueueEntryStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";

export interface QueueTimeoutJobData {
    queueEntryId: string;
    projectId: string;
}

@Processor("queue-timeout")
export class QueueTimeoutProcessor extends WorkerHost {
    private readonly logger = new Logger(QueueTimeoutProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
    ) {
        super();
    }

    async process(job: Job<QueueTimeoutJobData>): Promise<void> {
        const { queueEntryId, projectId } = job.data;

        try {
            const timedOutAt = new Date();

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
                UPDATE queue_entries
                SET status = ${QueueEntryStatus.TIMED_OUT}, timed_out_at = ${timedOutAt}
                WHERE id = ${queueEntryId}
                  AND project_id = ${projectId}
                  AND status = ${QueueEntryStatus.QUEUED}
                RETURNING id, project_id, game_mode_id, environment, region_key, team_id, queued_at
            `;

            if (timedOut.length === 0) {
                return;
            }

            const entry = timedOut[0];
            this.logger.log(`Timed out queue entry ${entry.id}`);

            await this.webhookDeliveryService.scheduleDelivery(entry.project_id, "queue.timeout", {
                event: "queue.timeout",
                queueEntryId: entry.id,
                teamId: entry.team_id,
                gameModeId: entry.game_mode_id,
                environment: entry.environment,
                regionKey: entry.region_key,
                queuedAt: entry.queued_at,
                timedOutAt,
            });
        } catch (err) {
            this.logger.error(`Failed to process queue timeout for entry ${queueEntryId}`, err);
            throw err;
        }
    }
}
