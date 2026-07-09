import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { QueuesService } from "./queues.service";

type SweepCandidate = {
    matchPoolId: string;
    projectId: string;
    gameModeId: string;
    environment: string;
    regionKey: string;
};

/**
 * Safety net for the fire-and-forget match-making attempt QueuesService kicks off
 * right after enqueue: if that attempt is lost (process restart, unhandled error)
 * before a pool fills up, this sweep catches it on the next tick. tryCreateMatch's
 * own FOR UPDATE SKIP LOCKED guards against double-matching, so it's safe for this
 * to overlap with a concurrent fire-and-forget attempt on the same pool.
 */
@Injectable()
export class MatchMakerSweepProcessor {
    private readonly logger = new Logger(MatchMakerSweepProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly queuesService: QueuesService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {}

    @Cron("*/20 * * * * *")
    async sweepStalledPools() {
        this.schedulerHealthService.recordRun(SCHEDULER_JOBS.MATCH_MAKER_SWEEP);

        try {
            await this.sweep();
        } catch (err) {
            this.logger.error("Failed to sweep match pools", err);
        }
    }

    private async sweep() {
        const candidates = await this.findPoolsWithEnoughQueuedEntries();

        // Sequential on purpose: tryCreateMatch opens its own transaction against a
        // Prisma pool capped at 3 connections, so running many pools concurrently
        // here would starve regular request traffic.
        for (const pool of candidates) {
            const matchId = await this.queuesService.tryCreateMatch(pool.matchPoolId).catch((err: unknown) => {
                this.logger.error(`tryCreateMatch failed for pool ${pool.matchPoolId}`, err);
                return null;
            });

            if (matchId) {
                await this.queuesService
                    .scheduleMatchCreatedWebhook(
                        pool.projectId,
                        matchId,
                        pool.gameModeId,
                        pool.environment,
                        pool.regionKey,
                    )
                    .catch((err: unknown) => {
                        this.logger.error(`Failed to schedule match.created webhook for match ${matchId}`, err);
                    });
            }
        }
    }

    private async findPoolsWithEnoughQueuedEntries() {
        return this.prismaService.client.$queryRaw<Array<SweepCandidate>>`
            SELECT
                qe.match_pool_id AS "matchPoolId",
                mp.project_id AS "projectId",
                mp.game_mode_id AS "gameModeId",
                mp.environment,
                mp.region_key AS "regionKey"
            FROM queue_entries qe
            JOIN match_pools mp ON mp.id = qe.match_pool_id
            JOIN game_modes gm ON gm.id = mp.game_mode_id
            WHERE qe.status = 'QUEUED'
            GROUP BY qe.match_pool_id, mp.project_id, mp.game_mode_id, mp.environment, mp.region_key, gm.required_slots
            HAVING count(*) >= gm.required_slots
        `;
    }
}
