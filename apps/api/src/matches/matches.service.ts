import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStatus, Prisma, RatingMode } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { RatingsService } from "../ratings/ratings.service";
import type { ListMatchesQueryDto } from "./dto/list-matches-query.dto";
import type { ReportResultDto } from "./dto/report-result.dto";

@Injectable()
export class MatchesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly ratingsService: RatingsService,
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