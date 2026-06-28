import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ListRatingHistoryQueryDto } from "./dto/list-rating-history-query.dto";

const INITIAL_RATING = 1200;
const K_FACTOR = 32;

export type PlayerRatingUpdate = {
    playerId: string;
    ratingBefore: number;
    ratingAfter: number;
    delta: number;
};

@Injectable()
export class RatingsService {
    constructor(private readonly prismaService: PrismaService) {}

    async applyEloForVersusMatch(
        projectId: string,
        gameModeId: string,
        matchId: string,
        winnerPlayerIds: string[],
        loserPlayerIds: string[],
    ): Promise<PlayerRatingUpdate[]> {
        const allPlayerIds = [...winnerPlayerIds, ...loserPlayerIds];

        const profiles = await Promise.all(
            allPlayerIds.map((playerId) =>
                this.prismaService.client.ratingProfile.upsert({
                    where: { projectId_gameModeId_playerId: { projectId, gameModeId, playerId } },
                    update: {},
                    create: { projectId, gameModeId, playerId, rating: INITIAL_RATING, gamesPlayed: 0 },
                }),
            ),
        );

        const ratingMap = new Map(profiles.map((p) => [p.playerId, p]));

        const winnerRatings = winnerPlayerIds.map((id) => ratingMap.get(id)!.rating);
        const loserRatings = loserPlayerIds.map((id) => ratingMap.get(id)!.rating);
        const winnerAvg = winnerRatings.reduce((s, r) => s + r, 0) / winnerRatings.length;
        const loserAvg = loserRatings.reduce((s, r) => s + r, 0) / loserRatings.length;

        const updates: PlayerRatingUpdate[] = [];

        for (const playerId of winnerPlayerIds) {
            const profile = ratingMap.get(playerId)!;
            const expected = this.expectedScore(profile.rating, loserAvg);
            const delta = Math.round(K_FACTOR * (1 - expected));
            updates.push({ playerId, ratingBefore: profile.rating, ratingAfter: profile.rating + delta, delta });
        }

        for (const playerId of loserPlayerIds) {
            const profile = ratingMap.get(playerId)!;
            const expected = this.expectedScore(profile.rating, winnerAvg);
            const delta = Math.round(K_FACTOR * (0 - expected));
            updates.push({ playerId, ratingBefore: profile.rating, ratingAfter: profile.rating + delta, delta });
        }

        await this.prismaService.client.$transaction(async (tx) => {
            for (const update of updates) {
                const profile = ratingMap.get(update.playerId)!;
                await tx.ratingProfile.update({
                    where: { id: profile.id },
                    data: { rating: update.ratingAfter, gamesPlayed: { increment: 1 } },
                });
                await tx.ratingHistory.create({
                    data: {
                        ratingProfileId: profile.id,
                        matchId,
                        ratingBefore: update.ratingBefore,
                        ratingAfter: update.ratingAfter,
                        delta: update.delta,
                    },
                });
            }
        });

        return updates;
    }

    async listHistory(projectId: string, query: ListRatingHistoryQueryDto) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;

        const where = {
            ratingProfile: {
                projectId,
                ...(query.gameModeId ? { gameModeId: query.gameModeId } : {}),
                ...(query.playerId ? { playerId: query.playerId } : {}),
            },
        };

        const [data, total] = await Promise.all([
            this.prismaService.client.ratingHistory.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    matchId: true,
                    ratingBefore: true,
                    ratingAfter: true,
                    delta: true,
                    createdAt: true,
                    ratingProfile: {
                        select: { playerId: true, gameModeId: true },
                    },
                },
            }),
            this.prismaService.client.ratingHistory.count({ where }),
        ]);

        return { data, total };
    }

    private expectedScore(ratingA: number, ratingB: number): number {
        return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    }
}
