import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MatchesService {
    constructor(private readonly prismaService: PrismaService) {}

    async findOne(projectId: string, matchId: string) {
        const match = await this.prismaService.client.match.findFirst({
            where: {
                id: matchId,
                projectId,
            },
            include: {
                slots: {
                    orderBy: {
                        slotIndex: "asc",
                    },
                },
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