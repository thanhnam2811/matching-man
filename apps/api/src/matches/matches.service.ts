import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    MatchStatus,
    PenaltyReason,
    Prisma,
    QueueEntryStatus,
    RatingMode,
    SlotAcceptStatus,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { RatingsService } from "../ratings/ratings.service";
import { PenaltiesService } from "../penalties/penalties.service";
import { QueuesService } from "../queues/queues.service";
import type { ListMatchesQueryDto } from "./dto/list-matches-query.dto";
import type { ReportResultDto } from "./dto/report-result.dto";
import type { AcceptMatchDto } from "./dto/accept-match.dto";
import type { DeclineMatchDto } from "./dto/decline-match.dto";

@Injectable()
export class MatchesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly ratingsService: RatingsService,
        private readonly penaltiesService: PenaltiesService,
        private readonly queuesService: QueuesService,
        @InjectQueue("ready-check-timeout") private readonly readyCheckTimeoutQueue: Queue,
    ) {}

    async findOne(projectId: string, matchId: string) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
            include: {
                slots: { orderBy: { slotIndex: "asc" } },
            },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        return {
            id: match.id,
            projectId: match.projectId,
            gameModeId: match.gameModeId,
            status: match.status.toLowerCase(),
            environment: match.environment,
            region: match.regionKey,
            requiredSlots: match.requiredSlots,
            groupCount: match.groupCount,
            createdAt: match.createdAt,
            slots: match.slots.map((slot) => ({
                slotIndex: slot.slotIndex,
                groupIndex: slot.groupIndex,
                teamId: slot.teamId,
                members: this.toTeamMembersSnapshot(slot.teamSnapshot).map((member) => ({
                    playerId: member.playerId,
                    rating: member.rating,
                })),
            })),
        };
    }

    async listMatches(projectId: string, query: ListMatchesQueryDto) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;

        const where: Prisma.MatchWhereInput = {
            projectId,
            ...(query.gameModeId ? { gameModeId: query.gameModeId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.from || query.to
                ? {
                      createdAt: {
                          ...(query.from ? { gte: new Date(query.from) } : {}),
                          ...(query.to ? { lte: new Date(query.to) } : {}),
                      },
                  }
                : {}),
        };

        const [matches, total] = await Promise.all([
            this.prismaService.client.match.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    gameModeId: true,
                    status: true,
                    environment: true,
                    regionKey: true,
                    requiredSlots: true,
                    groupCount: true,
                    ratingMode: true,
                    createdAt: true,
                    result: {
                        select: { winnerGroupIndex: true, endedAt: true },
                    },
                },
            }),
            this.prismaService.client.match.count({ where }),
        ]);

        return {
            data: matches.map((match) => ({
                id: match.id,
                gameModeId: match.gameModeId,
                status: match.status.toLowerCase(),
                environment: match.environment,
                region: match.regionKey,
                requiredSlots: match.requiredSlots,
                groupCount: match.groupCount,
                ratingMode: match.ratingMode.toLowerCase(),
                createdAt: match.createdAt,
                result: match.result
                    ? { winnerGroupIndex: match.result.winnerGroupIndex, endedAt: match.result.endedAt }
                    : null,
            })),
            total,
        };
    }

    async reportResult(projectId: string, matchId: string, dto: ReportResultDto) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
            include: {
                slots: { orderBy: { slotIndex: "asc" } },
                result: true,
            },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        // Idempotency: replay if this match already has a result
        if (match.result) {
            return this.toResultResponse(match.result, "skipped");
        }

        if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.FAILED) {
            throw new ConflictException(`Match is already ${match.status.toLowerCase()}`);
        }

        if (dto.winnerGroupIndex !== undefined && dto.winnerGroupIndex > match.groupCount) {
            throw new BadRequestException(
                `winnerGroupIndex ${dto.winnerGroupIndex} exceeds match groupCount ${match.groupCount}`,
            );
        }

        const result = await this.prismaService.client.$transaction(async (tx) => {
            const created = await tx.matchResult.create({
                data: {
                    matchId,
                    idempotencyKey: dto.idempotencyKey ?? null,
                    winnerGroupIndex: dto.winnerGroupIndex ?? null,
                    endedAt: new Date(dto.endedAt),
                    metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
                },
            });

            await tx.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.COMPLETED },
            });

            return created;
        });

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.completed", {
            event: "match.completed",
            matchId,
            gameModeId: match.gameModeId,
            environment: match.environment,
            regionKey: match.regionKey,
            winnerGroupIndex: result.winnerGroupIndex,
            endedAt: result.endedAt,
        });

        let ratingUpdateStatus: "skipped" | "completed" = "skipped";

        if (match.ratingMode === RatingMode.INTERNAL_ELO && dto.winnerGroupIndex !== undefined) {
            const winnerPlayerIds = match.slots
                .filter((s) => s.groupIndex === dto.winnerGroupIndex)
                .flatMap((s) => this.toTeamMembersSnapshot(s.teamSnapshot).map((m) => m.playerId));

            const loserPlayerIds = match.slots
                .filter((s) => s.groupIndex !== dto.winnerGroupIndex)
                .flatMap((s) => this.toTeamMembersSnapshot(s.teamSnapshot).map((m) => m.playerId));

            if (winnerPlayerIds.length > 0 && loserPlayerIds.length > 0) {
                const updates = await this.ratingsService.applyEloForVersusMatch(
                    projectId,
                    match.gameModeId,
                    matchId,
                    winnerPlayerIds,
                    loserPlayerIds,
                );

                await this.webhookDeliveryService.scheduleDelivery(projectId, "rating.updated", {
                    event: "rating.updated",
                    matchId,
                    gameModeId: match.gameModeId,
                    updates: updates.map((u) => ({
                        playerId: u.playerId,
                        ratingBefore: u.ratingBefore,
                        ratingAfter: u.ratingAfter,
                        delta: u.delta,
                    })),
                });

                ratingUpdateStatus = "completed";
            }
        }

        return this.toResultResponse(result, ratingUpdateStatus);
    }

    async acceptMatch(projectId: string, matchId: string, dto: AcceptMatchDto) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
            include: {
                slots: { orderBy: { slotIndex: "asc" } },
                gameMode: true,
            },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        if (match.status !== MatchStatus.PENDING_ACCEPTANCE) {
            throw new BadRequestException("Match is not in pending acceptance state");
        }

        const slot = match.slots.find((s) => s.teamId === dto.teamId);
        if (!slot) {
            throw new NotFoundException("Team not found in this match");
        }

        const teamMembers = this.toTeamMembersSnapshot(slot.teamSnapshot);
        if (!teamMembers.some((m) => m.playerId === dto.playerId)) {
            throw new BadRequestException("Player is not a member of this team");
        }

        const acceptedPlayerIds = Array.isArray(slot.acceptedPlayerIds) ? (slot.acceptedPlayerIds as string[]) : [];

        if (!acceptedPlayerIds.includes(dto.playerId)) {
            acceptedPlayerIds.push(dto.playerId);
        }

        const allSlotMembersAccepted = teamMembers.every((m) => acceptedPlayerIds.includes(m.playerId));

        await this.prismaService.client.matchSlot.update({
            where: { id: slot.id },
            data: {
                acceptedPlayerIds,
                ...(allSlotMembersAccepted ? { acceptStatus: SlotAcceptStatus.ACCEPTED, respondedAt: new Date() } : {}),
            },
        });

        // Re-check all slots
        const updatedSlots = await this.prismaService.client.matchSlot.findMany({
            where: { matchId },
        });

        const acceptedSlotCount = updatedSlots.filter((s) => s.acceptStatus === SlotAcceptStatus.ACCEPTED).length;
        const totalSlots = match.slots.length;
        const isComplete = acceptedSlotCount === totalSlots;

        if (isComplete) {
            await this.prismaService.client.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.CONFIRMED },
            });

            await this.readyCheckTimeoutQueue.remove(`ready-check-${matchId}`).catch(() => {});

            await this.webhookDeliveryService.scheduleDelivery(projectId, "match.confirmed", {
                event: "match.confirmed",
                matchId: match.id,
                gameModeId: match.gameModeId,
                environment: match.environment,
                regionKey: match.regionKey,
            });

            return {
                matchId: match.id,
                status: "confirmed",
                acceptedCount: totalSlots,
                requiredCount: totalSlots,
                isComplete: true,
            };
        }

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.accepted", {
            event: "match.accepted",
            matchId: match.id,
            playerId: dto.playerId,
            acceptedCount: acceptedSlotCount,
            requiredCount: totalSlots,
        });

        return {
            matchId: match.id,
            status: "pending_acceptance",
            acceptedCount: acceptedSlotCount,
            requiredCount: totalSlots,
            isComplete: false,
        };
    }

    async declineMatch(projectId: string, matchId: string, dto: DeclineMatchDto) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
            include: {
                slots: { include: { queueEntry: true } },
                gameMode: true,
            },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        if (match.status !== MatchStatus.PENDING_ACCEPTANCE) {
            throw new BadRequestException("Match is not in pending acceptance state");
        }

        const slot = match.slots.find((s) => s.teamId === dto.teamId);
        if (!slot) {
            throw new NotFoundException("Team not found in this match");
        }

        // Set match to DECLINED
        await this.prismaService.client.match.update({
            where: { id: matchId },
            data: { status: MatchStatus.DECLINED },
        });

        // Set declining slot to DECLINED
        await this.prismaService.client.matchSlot.update({
            where: { id: slot.id },
            data: { acceptStatus: SlotAcceptStatus.DECLINED, respondedAt: new Date() },
        });

        // Set declining team queue entry to CANCELLED
        await this.prismaService.client.queueEntry.update({
            where: { id: slot.queueEntryId },
            data: {
                status: QueueEntryStatus.CANCELLED,
                cancelledAt: new Date(),
                cancelReason: dto.reason ?? "Declined ready check",
            },
        });

        // Cancel timeout job
        await this.readyCheckTimeoutQueue.remove(`ready-check-${matchId}`).catch(() => {});

        // Apply penalty to decliner
        await this.penaltiesService.recordPenalty({
            projectId,
            playerId: dto.playerId,
            reason: PenaltyReason.DODGE,
            notes: dto.reason,
        });

        // Re-queue innocent opposing teams
        const innocentQueueEntryIds = match.slots.filter((s) => s.teamId !== dto.teamId).map((s) => s.queueEntryId);

        if (innocentQueueEntryIds.length > 0) {
            await this.queuesService.requeueInnocentEntries(projectId, innocentQueueEntryIds, match.matchPoolId);
        }

        // Emit webhook
        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.declined", {
            event: "match.declined",
            matchId: match.id,
            declinedByPlayerId: dto.playerId,
            reason: dto.reason,
        });

        return {
            matchId: match.id,
            status: "declined",
            declinedByPlayerId: dto.playerId,
            penaltyApplied: true,
        };
    }

    async getReadyCheckStatus(projectId: string, matchId: string) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
            include: {
                slots: { orderBy: { slotIndex: "asc" } },
                gameMode: true,
            },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        const timeoutSeconds = match.gameMode.readyCheckTimeoutSeconds ?? 20;
        const expiresAt = new Date(match.createdAt.getTime() + timeoutSeconds * 1000);
        const remainingSeconds = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

        return {
            matchId: match.id,
            status: match.status.toLowerCase(),
            timeoutSeconds,
            expiresAt,
            remainingSeconds: match.status === MatchStatus.PENDING_ACCEPTANCE ? remainingSeconds : 0,
            slots: match.slots.map((s) => ({
                slotIndex: s.slotIndex,
                groupIndex: s.groupIndex,
                teamId: s.teamId,
                acceptStatus: s.acceptStatus.toLowerCase(),
                respondedAt: s.respondedAt,
                acceptedPlayerIds: s.acceptedPlayerIds,
            })),
        };
    }

    private toResultResponse(
        result: { matchId: string; winnerGroupIndex: number | null; endedAt: Date; createdAt: Date },
        ratingUpdateStatus: "skipped" | "completed",
    ) {
        return {
            matchId: result.matchId,
            status: "completed",
            winnerGroupIndex: result.winnerGroupIndex,
            endedAt: result.endedAt,
            ratingUpdateStatus,
        };
    }

    private toTeamMembersSnapshot(snapshot: unknown) {
        if (!Array.isArray(snapshot)) {
            return [];
        }

        return snapshot.flatMap((member) => {
            if (typeof member !== "object" || member === null) {
                return [];
            }

            const playerId = "playerId" in member ? member.playerId : undefined;
            const rating = "rating" in member ? member.rating : undefined;

            if (typeof playerId !== "string") {
                return [];
            }

            return [
                {
                    playerId,
                    rating: typeof rating === "number" ? rating : null,
                },
            ];
        });
    }
}
