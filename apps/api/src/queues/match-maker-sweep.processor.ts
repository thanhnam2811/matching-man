import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Job } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { QueuesService } from "./queues.service";

export interface MatchmakingPoolJobData {
    matchPoolId: string;
    projectId: string;
}

type SweepCandidate = {
    matchPoolId: string;
    projectId: string;
    gameModeId: string;
    environment: string;
    regionKey: string;
};

@Processor("matchmaking-pool", { concurrency: 5 })
export class MatchMakerSweepProcessor extends WorkerHost {
    private readonly logger = new Logger(MatchMakerSweepProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly queuesService: QueuesService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {
        super();
    }

    async process(job: Job<MatchmakingPoolJobData>): Promise<void> {
        const { matchPoolId } = job.data;

        try {
            const matchId = await this.queuesService.tryCreateMatch(matchPoolId);

            if (matchId) {
                await this.queuesService.handleMatchPostCreation(matchId);
            }
        } catch (err) {
            this.logger.error(`Failed to process matchmaking pool job for ${matchPoolId}`, err);
            throw err;
        }
    }

    @Cron("0 * * * * *")
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

        for (const pool of candidates) {
            await this.queuesService.triggerPoolMatching(pool.matchPoolId, pool.projectId).catch((err: unknown) => {
                this.logger.error(`Failed to trigger pool matching for ${pool.matchPoolId}`, err);
            });
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
