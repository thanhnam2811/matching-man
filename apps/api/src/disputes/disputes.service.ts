import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DisputeStatus, MatchStatus, Prisma, RatingMode } from "../generated/prisma/client";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { PrismaService } from "../prisma/prisma.service";
import { type PlayerRatingUpdate, RatingsService } from "../ratings/ratings.service";
import type { CreateMatchDisputeDto } from "./dto/create-match-dispute.dto";
import type { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import type { RejectDisputeDto } from "./dto/reject-dispute.dto";
import type { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

@Injectable()
export class DisputesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly ratingsService: RatingsService,
    ) {}

    async createDispute(projectId: string, matchId: string, dto: CreateMatchDisputeDto) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        const existingDispute = await this.prismaService.client.matchDispute.findFirst({
            where: {
                matchId,
                projectId,
                status: DisputeStatus.OPEN,
            },
        });

        if (existingDispute) {
            throw new ConflictException("An open dispute already exists for this match");
        }

        const dispute = await this.prismaService.client.$transaction(async (tx) => {
            const created = await tx.matchDispute.create({
                data: {
                    projectId,
                    matchId,
                    claimantTeamId: dto.claimantTeamId ?? null,
                    reason: dto.reason,
                    evidence: dto.evidence ? (dto.evidence as Prisma.InputJsonValue) : undefined,
                    status: DisputeStatus.OPEN,
                },
            });

            await tx.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.DISPUTED },
            });

            return created;
        });

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.disputed", {
            event: "match.disputed",
            matchId,
            disputeId: dispute.id,
            claimantTeamId: dispute.claimantTeamId,
            reason: dispute.reason,
            createdAt: dispute.createdAt,
        });

        return dispute;
    }

    async findAll(projectId: string, query: ListDisputesQueryDto) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;

        const where = {
            projectId,
            ...(query.status ? { status: query.status } : {}),
        };

        const [data, total] = await Promise.all([
            this.prismaService.client.matchDispute.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    match: {
                        select: {
                            id: true,
                            gameModeId: true,
                            environment: true,
                            regionKey: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                    resolvedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prismaService.client.matchDispute.count({ where }),
        ]);

        return { data, total };
    }

    async findOne(projectId: string, disputeId: string) {
        const dispute = await this.prismaService.client.matchDispute.findFirst({
            where: { id: disputeId, projectId },
            include: {
                match: {
                    include: {
                        slots: true,
                        result: true,
                        gameMode: true,
                    },
                },
                resolvedByUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!dispute) {
            throw new NotFoundException("Dispute not found");
        }

        return dispute;
    }

    async resolveDispute(context: DashboardAuthContext, projectId: string, disputeId: string, dto: ResolveDisputeDto) {
        const dispute = await this.prismaService.client.matchDispute.findFirst({
            where: { id: disputeId, projectId },
            include: {
                match: {
                    include: {
                        slots: true,
                        result: true,
                    },
                },
            },
        });

        if (!dispute) {
            throw new NotFoundException("Dispute not found");
        }

        if (dispute.status !== DisputeStatus.OPEN) {
            throw new BadRequestException("Dispute is not in OPEN status");
        }

        const overrideWinnerGroupIndex = dto.overrideWinnerGroupIndex ?? null;

        const updatedDispute = await this.prismaService.client.$transaction(async (tx) => {
            const updated = await tx.matchDispute.update({
                where: { id: disputeId },
                data: {
                    status: DisputeStatus.RESOLVED,
                    overrideWinnerGroupIndex,
                    resolvedByUserId: context.authUserId ?? null,
                    resolvedAt: new Date(),
                    resolutionNotes: dto.resolutionNotes,
                },
            });

            await tx.match.update({
                where: { id: dispute.matchId },
                data: { status: MatchStatus.COMPLETED },
            });

            if (dispute.match.result) {
                await tx.matchResult.update({
                    where: { matchId: dispute.matchId },
                    data: { winnerGroupIndex: overrideWinnerGroupIndex },
                });
            } else {
                await tx.matchResult.create({
                    data: {
                        matchId: dispute.matchId,
                        winnerGroupIndex: overrideWinnerGroupIndex,
                        endedAt: new Date(),
                    },
                });
            }

            return updated;
        });

        let ratingUpdates: PlayerRatingUpdate[] = [];

        if (dispute.match.ratingMode === RatingMode.INTERNAL_ELO) {
            let winnerPlayerIds: string[] = [];
            let loserPlayerIds: string[] = [];

            if (overrideWinnerGroupIndex !== null && overrideWinnerGroupIndex !== undefined) {
                winnerPlayerIds = dispute.match.slots
                    .filter((s) => s.groupIndex === overrideWinnerGroupIndex)
                    .flatMap((s) => this.toTeamMembersSnapshot(s.teamSnapshot).map((m) => m.playerId));

                loserPlayerIds = dispute.match.slots
                    .filter((s) => s.groupIndex !== overrideWinnerGroupIndex)
                    .flatMap((s) => this.toTeamMembersSnapshot(s.teamSnapshot).map((m) => m.playerId));
            }

            ratingUpdates = await this.ratingsService.reconcileEloForDispute(
                projectId,
                dispute.match.gameModeId,
                dispute.matchId,
                winnerPlayerIds,
                loserPlayerIds,
            );
        }

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.dispute_resolved", {
            event: "match.dispute_resolved",
            matchId: dispute.matchId,
            disputeId: updatedDispute.id,
            status: DisputeStatus.RESOLVED,
            overrideWinnerGroupIndex: updatedDispute.overrideWinnerGroupIndex,
            resolvedByUserId: updatedDispute.resolvedByUserId,
            resolvedAt: updatedDispute.resolvedAt,
            resolutionNotes: updatedDispute.resolutionNotes,
        });

        if (ratingUpdates.length > 0) {
            await this.webhookDeliveryService.scheduleDelivery(projectId, "rating.updated", {
                event: "rating.updated",
                matchId: dispute.matchId,
                gameModeId: dispute.match.gameModeId,
                updates: ratingUpdates.map((u) => ({
                    playerId: u.playerId,
                    ratingBefore: u.ratingBefore,
                    ratingAfter: u.ratingAfter,
                    delta: u.delta,
                })),
            });
        }

        return updatedDispute;
    }

    async rejectDispute(context: DashboardAuthContext, projectId: string, disputeId: string, dto: RejectDisputeDto) {
        const dispute = await this.prismaService.client.matchDispute.findFirst({
            where: { id: disputeId, projectId },
            include: {
                match: {
                    include: {
                        result: true,
                    },
                },
            },
        });

        if (!dispute) {
            throw new NotFoundException("Dispute not found");
        }

        if (dispute.status !== DisputeStatus.OPEN) {
            throw new BadRequestException("Dispute is not in OPEN status");
        }

        const updatedDispute = await this.prismaService.client.$transaction(async (tx) => {
            const updated = await tx.matchDispute.update({
                where: { id: disputeId },
                data: {
                    status: DisputeStatus.REJECTED,
                    resolvedByUserId: context.authUserId ?? null,
                    resolvedAt: new Date(),
                    resolutionNotes: dto.resolutionNotes,
                },
            });

            await tx.match.update({
                where: { id: dispute.matchId },
                data: { status: MatchStatus.COMPLETED },
            });

            return updated;
        });

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.dispute_resolved", {
            event: "match.dispute_resolved",
            matchId: dispute.matchId,
            disputeId: updatedDispute.id,
            status: DisputeStatus.REJECTED,
            overrideWinnerGroupIndex: null,
            resolvedByUserId: updatedDispute.resolvedByUserId,
            resolvedAt: updatedDispute.resolvedAt,
            resolutionNotes: updatedDispute.resolutionNotes,
        });

        return updatedDispute;
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
