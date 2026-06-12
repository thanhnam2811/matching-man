import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStatus, MatchStructure, Prisma, QueueEntryStatus, RatingMode } from "../generated/prisma/client";
import { GameModesService } from "../game-modes/game-modes.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectEnvironmentsService } from "../projects/project-environments.service";
import { DequeueDto } from "./dto/dequeue.dto";
import { EnqueueDto } from "./dto/enqueue.dto";

@Injectable()
export class QueuesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly gameModesService: GameModesService,
        private readonly projectEnvironmentsService: ProjectEnvironmentsService,
    ) {}

    async enqueue(authProjectId: string, enqueueDto: EnqueueDto) {
        if (authProjectId !== enqueueDto.projectId) {
            throw new ConflictException("Authenticated project does not match projectId");
        }

        const gameMode = await this.gameModesService.findOne(authProjectId, enqueueDto.gameModeId);
        const teamSize = enqueueDto.team.members.length;

        if (teamSize < gameMode.teamSizeMin || teamSize > gameMode.teamSizeMax) {
            throw new BadRequestException("Team size is outside the allowed range");
        }

        const environment = await this.projectEnvironmentsService.assertExists(authProjectId, enqueueDto.environment);

        if (enqueueDto.idempotencyKey) {
            const existing = await this.prismaService.client.queueEntry.findFirst({
                where: {
                    projectId: authProjectId,
                    idempotencyKey: enqueueDto.idempotencyKey,
                },
                include: {
                    matchSlots: {
                        include: {
                            match: true,
                        },
                    },
                },
            });

            if (existing) {
                return this.toQueueResponse(existing);
            }
        }

        const regionKey = enqueueDto.region?.trim() || "global";

        const queueEntry = await this.prismaService.client.$transaction(async (tx) => {
            const pool = await tx.matchPool.upsert({
                where: {
                    projectId_gameModeId_environment_regionKey: {
                        projectId: authProjectId,
                        gameModeId: gameMode.id,
                        environment,
                        regionKey,
                    },
                },
                update: {},
                create: {
                    projectId: authProjectId,
                    gameModeId: gameMode.id,
                    environment,
                    regionKey,
                },
            });

            const team = enqueueDto.team.externalTeamId
                ? await this.upsertExternalTeam(
                      tx,
                      authProjectId,
                      enqueueDto.team.externalTeamId,
                      enqueueDto.team.members,
                  )
                : await this.createAnonymousTeam(tx, authProjectId, enqueueDto.team.members);

            return tx.queueEntry.create({
                data: {
                    projectId: authProjectId,
                    gameModeId: gameMode.id,
                    matchPoolId: pool.id,
                    teamId: team.id,
                    environment,
                    regionKey,
                    idempotencyKey: enqueueDto.idempotencyKey,
                    ratingMode: gameMode.ratingMode,
                    metadata: enqueueDto.metadata ? (enqueueDto.metadata as Prisma.InputJsonValue) : undefined,
                },
                include: {
                    matchSlots: {
                        include: {
                            match: true,
                        },
                    },
                },
            });
        });

        await this.tryCreateMatch(queueEntry.matchPoolId);

        const freshQueueEntry = await this.prismaService.client.queueEntry.findUniqueOrThrow({
            where: {
                id: queueEntry.id,
            },
            include: {
                matchSlots: {
                    include: {
                        match: true,
                    },
                },
            },
        });

        return this.toQueueResponse(freshQueueEntry);
    }

    async dequeue(authProjectId: string, dequeueDto: DequeueDto) {
        if (dequeueDto.idempotencyKey) {
            const existingByIdempotency = await this.prismaService.client.queueEntry.findFirst({
                where: {
                    projectId: authProjectId,
                    dequeueIdempotencyKey: dequeueDto.idempotencyKey,
                },
            });

            if (existingByIdempotency) {
                if (existingByIdempotency.id !== dequeueDto.queueEntryId) {
                    throw new ConflictException("Idempotency key is already associated with a different queue entry");
                }

                return {
                    queueEntryId: existingByIdempotency.id,
                    status: existingByIdempotency.status.toLowerCase(),
                };
            }
        }

        const queueEntry = await this.prismaService.client.queueEntry.findFirst({
            where: {
                id: dequeueDto.queueEntryId,
                projectId: authProjectId,
            },
        });

        if (!queueEntry) {
            throw new NotFoundException("Queue entry not found");
        }

        if (queueEntry.status !== QueueEntryStatus.QUEUED) {
            return {
                queueEntryId: queueEntry.id,
                status: queueEntry.status.toLowerCase(),
            };
        }

        const updated = await this.prismaService.client.queueEntry.update({
            where: {
                id: queueEntry.id,
            },
            data: {
                status: QueueEntryStatus.CANCELLED,
                cancelledAt: new Date(),
                cancelReason: dequeueDto.reason ?? "cancelled",
                dequeueIdempotencyKey: dequeueDto.idempotencyKey,
                dequeueRequestedAt: new Date(),
            },
        });

        return {
            queueEntryId: updated.id,
            status: updated.status.toLowerCase(),
        };
    }

    private async tryCreateMatch(matchPoolId: string) {
        return this.prismaService.client.$transaction(async (tx) => {
            const pool = await tx.matchPool.findUnique({
                where: {
                    id: matchPoolId,
                },
                include: {
                    gameMode: true,
                },
            });

            if (!pool) {
                return null;
            }

            const isConfiguredEnvironment = await this.projectEnvironmentsService.isConfigured(
                pool.projectId,
                pool.environment,
            );

            if (!isConfiguredEnvironment) {
                return null;
            }

            const lockedRows = await tx.$queryRaw<Array<{ id: string }>>(
                Prisma.sql`
          SELECT id
          FROM queue_entries
          WHERE match_pool_id = ${matchPoolId}
            AND status = ${QueueEntryStatus.QUEUED}
          ORDER BY queued_at ASC, id ASC
          LIMIT ${Math.max(pool.gameMode.requiredSlots * 4, pool.gameMode.requiredSlots)}
          FOR UPDATE SKIP LOCKED
        `,
            );

            if (lockedRows.length < pool.gameMode.requiredSlots) {
                return null;
            }

            const candidateEntries = await tx.queueEntry.findMany({
                where: {
                    id: {
                        in: lockedRows.map((row) => row.id),
                    },
                },
                orderBy: {
                    queuedAt: "asc",
                },
                include: {
                    team: {
                        include: {
                            members: {
                                orderBy: {
                                    createdAt: "asc",
                                },
                            },
                        },
                    },
                },
            });

            const queueEntries = this.selectCandidateQueueEntries(
                candidateEntries,
                pool.gameMode.ratingMode,
                pool.gameMode.requiredSlots,
            );

            if (queueEntries.length < pool.gameMode.requiredSlots) {
                return null;
            }

            const queueEntryIds = queueEntries.map((queueEntry) => queueEntry.id);

            const match = await tx.match.create({
                data: {
                    projectId: pool.projectId,
                    gameModeId: pool.gameModeId,
                    matchPoolId: pool.id,
                    environment: pool.environment,
                    regionKey: pool.regionKey,
                    status: MatchStatus.CREATED,
                    ratingMode: pool.gameMode.ratingMode,
                    requiredSlots: pool.gameMode.requiredSlots,
                    groupCount: pool.gameMode.groupCount,
                },
            });

            await tx.matchSlot.createMany({
                data: queueEntries.map((queueEntry, index) => ({
                    matchId: match.id,
                    queueEntryId: queueEntry.id,
                    teamId: queueEntry.teamId,
                    slotIndex: index + 1,
                    groupIndex: this.computeGroupIndex(
                        pool.gameMode.matchStructure,
                        pool.gameMode.groupCount,
                        pool.gameMode.requiredSlots,
                        index + 1,
                    ),
                    teamSnapshot: queueEntry.team.members.map((member) => ({
                        playerId: member.playerId,
                        rating: member.ratingSnapshot,
                    })),
                })),
            });

            await tx.queueEntry.updateMany({
                where: {
                    id: {
                        in: queueEntryIds,
                    },
                },
                data: {
                    status: QueueEntryStatus.MATCHED,
                    matchedAt: new Date(),
                },
            });

            return match.id;
        });
    }

    private computeGroupIndex(
        matchStructure: MatchStructure,
        groupCount: number,
        requiredSlots: number,
        slotIndex: number,
    ) {
        if (matchStructure === MatchStructure.FFA) {
            return slotIndex;
        }

        const slotsPerGroup = requiredSlots / groupCount;
        return Math.floor((slotIndex - 1) / slotsPerGroup) + 1;
    }

    private selectCandidateQueueEntries(
        queueEntries: Array<{
            id: string;
            teamId: string;
            queuedAt: Date;
            team: {
                members: Array<{
                    playerId: string;
                    ratingSnapshot: number | null;
                }>;
            };
        }>,
        ratingMode: RatingMode,
        requiredSlots: number,
    ) {
        if (queueEntries.length < requiredSlots) {
            return [];
        }

        if (ratingMode !== RatingMode.EXTERNAL_RATING) {
            return queueEntries.slice(0, requiredSlots);
        }

        const ratedEntries = queueEntries
            .map((queueEntry) => ({
                queueEntry,
                teamRating: this.computeTeamRating(queueEntry.team.members),
            }))
            .filter((entry) => entry.teamRating !== null) as Array<{
            queueEntry: (typeof queueEntries)[number];
            teamRating: number;
        }>;

        if (ratedEntries.length < requiredSlots) {
            return [];
        }

        const anchor = ratedEntries[0];
        const selected = ratedEntries
            .slice(1)
            .toSorted((left, right) => {
                const delta =
                    Math.abs(left.teamRating - anchor.teamRating) - Math.abs(right.teamRating - anchor.teamRating);

                if (delta !== 0) {
                    return delta;
                }

                return left.queueEntry.queuedAt.getTime() - right.queueEntry.queuedAt.getTime();
            })
            .slice(0, requiredSlots - 1)
            .map((entry) => entry.queueEntry);

        return [anchor.queueEntry, ...selected].toSorted(
            (left, right) => left.queuedAt.getTime() - right.queuedAt.getTime(),
        );
    }

    private computeTeamRating(members: Array<{ ratingSnapshot: number | null }>) {
        if (members.length === 0 || members.some((member) => member.ratingSnapshot === null)) {
            return null;
        }

        const total = members.reduce((sum, member) => sum + (member.ratingSnapshot ?? 0), 0);
        return total / members.length;
    }

    private async upsertExternalTeam(
        tx: Prisma.TransactionClient,
        projectId: string,
        externalTeamId: string,
        members: EnqueueDto["team"]["members"],
    ) {
        const team = await tx.team.upsert({
            where: {
                projectId_externalTeamId: {
                    projectId,
                    externalTeamId,
                },
            },
            update: {},
            create: {
                projectId,
                externalTeamId,
            },
        });

        await tx.teamMember.deleteMany({
            where: {
                teamId: team.id,
            },
        });

        await tx.teamMember.createMany({
            data: members.map((member) => ({
                teamId: team.id,
                playerId: member.playerId,
                ratingSnapshot: member.rating,
            })),
        });

        return team;
    }

    private async createAnonymousTeam(
        tx: Prisma.TransactionClient,
        projectId: string,
        members: EnqueueDto["team"]["members"],
    ) {
        const team = await tx.team.create({
            data: {
                projectId,
            },
        });

        await tx.teamMember.createMany({
            data: members.map((member) => ({
                teamId: team.id,
                playerId: member.playerId,
                ratingSnapshot: member.rating,
            })),
        });

        return team;
    }

    private toQueueResponse(queueEntry: {
        id: string;
        status: QueueEntryStatus;
        queuedAt: Date;
        projectId: string;
        environment: string;
        gameModeId: string;
        regionKey: string;
        matchSlots: Array<{ match: { id: string } }>;
    }) {
        return {
            queueEntryId: queueEntry.id,
            status: queueEntry.status.toLowerCase(),
            poolKey: `${queueEntry.projectId}:${queueEntry.environment}:${queueEntry.gameModeId}:${queueEntry.regionKey}`,
            queuedAt: queueEntry.queuedAt,
            matchId: queueEntry.matchSlots[0]?.match.id ?? null,
        };
    }
}