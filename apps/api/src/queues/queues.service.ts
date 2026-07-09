import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import { MatchStatus, MatchStructure, Prisma, QueueEntryStatus, RatingMode } from "../generated/prisma/client";
import { GameModesService } from "../game-modes/game-modes.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectEnvironmentsService } from "../projects/project-environments.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { DequeueDto } from "./dto/dequeue.dto";
import { EnqueueDto } from "./dto/enqueue.dto";

type MatchPoolContext = {
    poolId: string;
    projectId: string;
    environment: string;
    regionKey: string;
    gameModeId: string;
    ratingMode: RatingMode;
    requiredSlots: number;
    groupCount: number;
    matchStructure: MatchStructure;
    initialRatingWindow: number | null;
    windowExpandIntervalSeconds: number | null;
    windowExpandStep: number | null;
    environmentConfigured: boolean;
};

@Injectable()
export class QueuesService {
    private readonly logger = new Logger(QueuesService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly gameModesService: GameModesService,
        private readonly projectEnvironmentsService: ProjectEnvironmentsService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
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

        const inserted = await this.insertQueueEntry(authProjectId, gameMode, environment, regionKey, enqueueDto);

        // Fire-and-forget: match-making runs in the background after the response is
        // sent so the client isn't blocked on it. Must never throw unhandled - an
        // un-awaited rejected promise with no catch crashes the process. A periodic
        // sweep (MatchMakerSweepProcessor) is the safety net if this attempt is lost
        // (e.g. process restart between the response and this completing).
        void this.dispatchMatchMakingAsync(
            inserted.matchPoolId,
            authProjectId,
            gameMode.id,
            environment,
            regionKey,
        ).catch((error: unknown) => {
            this.logger.error(`Background match-making failed for pool ${inserted.matchPoolId}`, error);
        });

        return {
            queueEntryId: inserted.queueEntryId,
            status: QueueEntryStatus.QUEUED.toLowerCase(),
            poolKey: `${authProjectId}:${environment}:${gameMode.id}:${regionKey}`,
            queuedAt: inserted.queuedAt,
            matchId: null as string | null,
        };
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

    async getQueueEntry(projectId: string, queueEntryId: string) {
        const queueEntry = await this.prismaService.client.queueEntry.findFirst({
            where: {
                id: queueEntryId,
                projectId,
            },
            include: {
                matchSlots: {
                    include: {
                        match: true,
                    },
                },
            },
        });

        if (!queueEntry) {
            throw new NotFoundException("Queue entry not found");
        }

        return this.toQueueResponse(queueEntry);
    }

    async listPools(projectId: string) {
        const pools = await this.prismaService.client.matchPool.findMany({
            where: { projectId },
            include: {
                _count: {
                    select: {
                        queueEntries: { where: { status: QueueEntryStatus.QUEUED } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return pools.map((pool) => ({
            id: pool.id,
            gameModeId: pool.gameModeId,
            environment: pool.environment,
            regionKey: pool.regionKey,
            queuedCount: pool._count.queueEntries,
            createdAt: pool.createdAt,
        }));
    }

    /**
     * Collapses the pool upsert + team upsert/replace + queue entry insert into a
     * single round-trip via CTE-chained raw SQL (a plain statement is already
     * atomic in Postgres, so no explicit $transaction wrapper is needed here).
     */
    private async insertQueueEntry(
        projectId: string,
        gameMode: { id: string; ratingMode: RatingMode },
        environment: string,
        regionKey: string,
        enqueueDto: EnqueueDto,
    ) {
        const poolId = createId();
        const teamId = createId();
        const entryId = createId();
        const externalTeamId = enqueueDto.team.externalTeamId ?? null;
        const memberPlayerIds = enqueueDto.team.members.map((member) => member.playerId);
        const metadataJson = enqueueDto.metadata !== undefined ? JSON.stringify(enqueueDto.metadata) : null;

        const memberValues = Prisma.join(
            enqueueDto.team.members.map(
                (member) =>
                    Prisma.sql`(${createId()}, (SELECT id FROM team), ${member.playerId}, ${member.rating ?? null}, now())`,
            ),
        );

        const rows = await this.prismaService.client.$queryRaw<
            Array<{ queueEntryId: string; queuedAt: Date; matchPoolId: string; teamId: string }>
        >(Prisma.sql`
            WITH pool AS (
                INSERT INTO match_pools (id, project_id, game_mode_id, environment, region_key, created_at, updated_at)
                VALUES (${poolId}, ${projectId}, ${gameMode.id}, ${environment}, ${regionKey}, now(), now())
                ON CONFLICT (project_id, game_mode_id, environment, region_key)
                DO UPDATE SET updated_at = match_pools.updated_at
                RETURNING id
            ),
            team AS (
                INSERT INTO teams (id, project_id, external_team_id, created_at, updated_at)
                VALUES (${teamId}, ${projectId}, ${externalTeamId}, now(), now())
                ON CONFLICT (project_id, external_team_id) DO UPDATE SET updated_at = teams.updated_at
                RETURNING id
            ),
            deleted_stale AS (
                -- Preserves upsertExternalTeam's old exact-replace semantics: members
                -- absent from this enqueue's payload are dropped from the team.
                DELETE FROM team_members
                WHERE team_id = (SELECT id FROM team)
                  AND player_id NOT IN (${Prisma.join(memberPlayerIds)})
                RETURNING id
            ),
            members AS (
                INSERT INTO team_members (id, team_id, player_id, rating_snapshot, created_at)
                VALUES ${memberValues}
                ON CONFLICT (team_id, player_id) DO UPDATE SET rating_snapshot = EXCLUDED.rating_snapshot
                RETURNING team_id
            ),
            entry AS (
                INSERT INTO queue_entries
                    (id, project_id, game_mode_id, match_pool_id, team_id, environment, region_key,
                     idempotency_key, rating_mode, status, metadata, queued_at, created_at, updated_at)
                VALUES (
                    ${entryId}, ${projectId}, ${gameMode.id}, (SELECT id FROM pool), (SELECT id FROM team),
                    ${environment}, ${regionKey}, ${enqueueDto.idempotencyKey ?? null}, ${gameMode.ratingMode},
                    ${QueueEntryStatus.QUEUED}, ${metadataJson}::jsonb, now(), now(), now()
                )
                RETURNING id, queued_at
            )
            SELECT
                entry.id AS "queueEntryId",
                entry.queued_at AS "queuedAt",
                pool.id AS "matchPoolId",
                team.id AS "teamId",
                (SELECT count(*) FROM deleted_stale) AS "deletedStaleCount",
                (SELECT count(*) FROM members) AS "memberCount"
            FROM entry, pool, team
        `);

        return rows[0];
    }

    private async dispatchMatchMakingAsync(
        matchPoolId: string,
        projectId: string,
        gameModeId: string,
        environment: string,
        regionKey: string,
    ) {
        const matchId = await this.tryCreateMatch(matchPoolId);

        if (matchId) {
            await this.scheduleMatchCreatedWebhook(projectId, matchId, gameModeId, environment, regionKey);
        }
    }

    async scheduleMatchCreatedWebhook(
        projectId: string,
        matchId: string,
        gameModeId: string,
        environment: string,
        regionKey: string,
    ) {
        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.created", {
            event: "match.created",
            matchId,
            gameModeId,
            environment,
            regionKey,
        });
    }

    /**
     * Called both from the fire-and-forget path right after enqueue and from
     * MatchMakerSweepProcessor's periodic safety-net scan - must be independently
     * callable given only a matchPoolId (no live request context to lean on).
     */
    async tryCreateMatch(matchPoolId: string): Promise<string | null> {
        return this.prismaService.client.$transaction(async (tx) => {
            const poolRows = await tx.$queryRaw<Array<MatchPoolContext>>(Prisma.sql`
                SELECT
                    mp.id AS "poolId", mp.project_id AS "projectId", mp.environment, mp.region_key AS "regionKey",
                    mp.game_mode_id AS "gameModeId",
                    gm.rating_mode AS "ratingMode", gm.required_slots AS "requiredSlots", gm.group_count AS "groupCount",
                    gm.match_structure AS "matchStructure",
                    gm.initial_rating_window AS "initialRatingWindow",
                    gm.window_expand_interval_seconds AS "windowExpandIntervalSeconds",
                    gm.window_expand_step AS "windowExpandStep",
                    (pe.id IS NOT NULL) AS "environmentConfigured"
                FROM match_pools mp
                JOIN game_modes gm ON gm.id = mp.game_mode_id
                LEFT JOIN project_environments pe
                    ON pe.project_id = mp.project_id AND pe.name = mp.environment
                WHERE mp.id = ${matchPoolId}
            `);

            const pool = poolRows[0];

            if (!pool || !pool.environmentConfigured) {
                return null;
            }

            const lockedRows = await tx.$queryRaw<
                Array<{
                    id: string;
                    teamId: string;
                    queuedAt: Date;
                    members: Array<{ playerId: string; ratingSnapshot: number | null }>;
                }>
            >(
                Prisma.sql`
          WITH locked AS (
            SELECT id, team_id, queued_at
            FROM queue_entries
            WHERE match_pool_id = ${matchPoolId}
              AND status = ${QueueEntryStatus.QUEUED}
            ORDER BY queued_at ASC, id ASC
            LIMIT ${Math.max(pool.requiredSlots * 4, pool.requiredSlots)}
            FOR UPDATE SKIP LOCKED
          )
          SELECT
            l.id AS id,
            l.team_id AS "teamId",
            l.queued_at AS "queuedAt",
            COALESCE(
              json_agg(
                json_build_object('playerId', tm.player_id, 'ratingSnapshot', tm.rating_snapshot)
                ORDER BY tm.created_at ASC
              ) FILTER (WHERE tm.id IS NOT NULL),
              '[]'
            ) AS members
          FROM locked l
          LEFT JOIN team_members tm ON tm.team_id = l.team_id
          GROUP BY l.id, l.team_id, l.queued_at
          ORDER BY l.queued_at ASC, l.id ASC
        `,
            );

            if (lockedRows.length < pool.requiredSlots) {
                return null;
            }

            const candidateEntries = lockedRows.map((row) => ({
                id: row.id,
                teamId: row.teamId,
                queuedAt: row.queuedAt,
                team: { members: row.members },
            }));

            const queueEntries = this.selectCandidateQueueEntries(candidateEntries, pool);

            if (queueEntries.length < pool.requiredSlots) {
                return null;
            }

            const matchId = createId();

            const slotValues = Prisma.join(
                queueEntries.map((queueEntry, index) => {
                    const slotIndex = index + 1;
                    const groupIndex = this.computeGroupIndex(
                        pool.matchStructure,
                        pool.groupCount,
                        pool.requiredSlots,
                        slotIndex,
                    );
                    const teamSnapshot = JSON.stringify(
                        queueEntry.team.members.map((member) => ({
                            playerId: member.playerId,
                            rating: member.ratingSnapshot,
                        })),
                    );

                    return Prisma.sql`(${createId()}, ${queueEntry.id}, ${queueEntry.teamId}, ${slotIndex}::int, ${groupIndex}::int, ${teamSnapshot}::jsonb)`;
                }),
            );

            await tx.$executeRaw(Prisma.sql`
                WITH inserted_match AS (
                    INSERT INTO matches (id, project_id, game_mode_id, match_pool_id, environment, region_key, status,
                                          rating_mode, required_slots, group_count, created_at, updated_at)
                    VALUES (${matchId}, ${pool.projectId}, ${pool.gameModeId}, ${pool.poolId}, ${pool.environment},
                            ${pool.regionKey}, ${MatchStatus.CREATED}, ${pool.ratingMode}, ${pool.requiredSlots},
                            ${pool.groupCount}, now(), now())
                    RETURNING id
                ),
                inserted_slots AS (
                    INSERT INTO match_slots (id, match_id, queue_entry_id, team_id, slot_index, group_index, team_snapshot, created_at)
                    SELECT v.id, im.id, v.queue_entry_id, v.team_id, v.slot_index, v.group_index, v.team_snapshot, now()
                    FROM inserted_match im,
                         (VALUES ${slotValues}) AS v(id, queue_entry_id, team_id, slot_index, group_index, team_snapshot)
                    RETURNING queue_entry_id
                )
                UPDATE queue_entries
                SET status = ${QueueEntryStatus.MATCHED}, matched_at = now()
                FROM inserted_slots
                WHERE queue_entries.id = inserted_slots.queue_entry_id
            `);

            return matchId;
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
        gameMode: {
            ratingMode: RatingMode;
            requiredSlots: number;
            initialRatingWindow: number | null;
            windowExpandIntervalSeconds: number | null;
            windowExpandStep: number | null;
        },
    ) {
        const { ratingMode, requiredSlots, initialRatingWindow, windowExpandIntervalSeconds, windowExpandStep } =
            gameMode;

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

        const effectiveWindow = this.computeEffectiveWindow(
            anchor.queueEntry.queuedAt,
            initialRatingWindow,
            windowExpandIntervalSeconds,
            windowExpandStep,
        );

        const eligibleRest = ratedEntries.slice(1).filter((entry) => {
            if (effectiveWindow === null) {
                return true;
            }
            return Math.abs(entry.teamRating - anchor.teamRating) <= effectiveWindow;
        });

        if (eligibleRest.length < requiredSlots - 1) {
            return [];
        }

        const selected = eligibleRest
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

    private computeEffectiveWindow(
        queuedAt: Date,
        initialRatingWindow: number | null,
        windowExpandIntervalSeconds: number | null,
        windowExpandStep: number | null,
    ): number | null {
        if (initialRatingWindow === null || windowExpandIntervalSeconds === null || windowExpandStep === null) {
            return null;
        }
        const elapsedSeconds = (Date.now() - queuedAt.getTime()) / 1000;
        const expansions = Math.floor(elapsedSeconds / windowExpandIntervalSeconds);
        return initialRatingWindow + expansions * windowExpandStep;
    }

    private computeTeamRating(members: Array<{ ratingSnapshot: number | null }>) {
        if (members.length === 0 || members.some((member) => member.ratingSnapshot === null)) {
            return null;
        }

        const total = members.reduce((sum, member) => sum + (member.ratingSnapshot ?? 0), 0);
        return total / members.length;
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
