import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { MatchStatus, QueueEntryStatus, SlotAcceptStatus, PenaltyReason } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PenaltiesService } from "../penalties/penalties.service";
import { QueuesService } from "../queues/queues.service";

export interface ReadyCheckTimeoutJobData {
    matchId: string;
    projectId: string;
}

@Processor("ready-check-timeout", { concurrency: 5 })
@Injectable()
export class ReadyCheckTimeoutProcessor extends WorkerHost {
    private readonly logger = new Logger(ReadyCheckTimeoutProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly penaltiesService: PenaltiesService,
        private readonly queuesService: QueuesService,
    ) {
        super();
    }

    async process(job: Job<ReadyCheckTimeoutJobData>): Promise<void> {
        const { matchId, projectId } = job.data;

        try {
            const match = await this.prismaService.client.match.findFirst({
                where: { id: matchId, projectId },
                include: {
                    slots: {
                        include: { queueEntry: true },
                    },
                    gameMode: true,
                },
            });

            if (!match || match.status !== MatchStatus.PENDING_ACCEPTANCE) {
                return;
            }

            this.logger.log(`Ready check timed out for match ${matchId}. Cancelling and applying penalties.`);

            // Mark match as CANCELLED
            await this.prismaService.client.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.CANCELLED },
            });

            const innocentQueueEntryIds: string[] = [];

            for (const slot of match.slots) {
                if (slot.acceptStatus === SlotAcceptStatus.ACCEPTED) {
                    innocentQueueEntryIds.push(slot.queueEntryId);
                } else {
                    // Mark slot as TIMED_OUT
                    await this.prismaService.client.matchSlot.update({
                        where: { id: slot.id },
                        data: { acceptStatus: SlotAcceptStatus.TIMED_OUT },
                    });

                    // Mark queue entry as TIMED_OUT
                    await this.prismaService.client.queueEntry.update({
                        where: { id: slot.queueEntryId },
                        data: { status: QueueEntryStatus.TIMED_OUT, timedOutAt: new Date() },
                    });

                    // Identify AFK players in this slot
                    const acceptedPlayerIds = Array.isArray(slot.acceptedPlayerIds)
                        ? (slot.acceptedPlayerIds as string[])
                        : [];
                    const teamMembers = Array.isArray(slot.teamSnapshot)
                        ? (slot.teamSnapshot as Array<{ playerId: string }>)
                        : [];

                    for (const member of teamMembers) {
                        if (!acceptedPlayerIds.includes(member.playerId)) {
                            await this.penaltiesService.recordPenalty({
                                projectId,
                                playerId: member.playerId,
                                reason: PenaltyReason.AFK_TIMEOUT,
                            });
                        }
                    }
                }
            }

            // Priority re-queue innocent entries
            if (innocentQueueEntryIds.length > 0) {
                await this.queuesService.requeueInnocentEntries(projectId, innocentQueueEntryIds, match.matchPoolId);
            }

            // Emit match.ready_check_expired webhook
            await this.webhookDeliveryService.scheduleDelivery(projectId, "match.ready_check_expired", {
                event: "match.ready_check_expired",
                matchId: match.id,
                gameModeId: match.gameModeId,
                environment: match.environment,
                regionKey: match.regionKey,
            });
        } catch (error) {
            this.logger.error(`Error processing ready check timeout for match ${matchId}:`, error);
            throw error;
        }
    }
}
