import { Job } from "bullmq";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { PrismaService } from "../prisma/prisma.service";
import { MatchmakingPoolJobData, MatchMakerSweepProcessor } from "./match-maker-sweep.processor";
import { QueuesService } from "./queues.service";

describe("MatchMakerSweepProcessor", () => {
    describe("sweepStalledPools", () => {
        it("records a scheduler run even when the sweep query throws", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const prismaService = {
                client: { $queryRaw: jest.fn().mockRejectedValue(new Error("db down")) },
            } as unknown as PrismaService;
            const queuesService = {
                triggerPoolMatching: jest.fn(),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            await processor.sweepStalledPools();

            expect(schedulerHealthService.recordRun).toHaveBeenCalledWith(SCHEDULER_JOBS.MATCH_MAKER_SWEEP);
        });

        it("triggers pool matching jobs for candidate pools with enough queued entries", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const candidates = [
                {
                    matchPoolId: "pool_1",
                    projectId: "project_1",
                    gameModeId: "mode_1",
                    environment: "production",
                    regionKey: "global",
                },
                {
                    matchPoolId: "pool_2",
                    projectId: "project_2",
                    gameModeId: "mode_2",
                    environment: "production",
                    regionKey: "global",
                },
            ];
            const prismaService = {
                client: { $queryRaw: jest.fn().mockResolvedValue(candidates) },
            } as unknown as PrismaService;
            const queuesService = {
                triggerPoolMatching: jest.fn().mockResolvedValue(undefined),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            await processor.sweepStalledPools();

            expect(schedulerHealthService.recordRun).toHaveBeenCalledWith(SCHEDULER_JOBS.MATCH_MAKER_SWEEP);
            expect(queuesService.triggerPoolMatching).toHaveBeenCalledTimes(2);
            expect(queuesService.triggerPoolMatching).toHaveBeenNthCalledWith(1, "pool_1", "project_1");
            expect(queuesService.triggerPoolMatching).toHaveBeenNthCalledWith(2, "pool_2", "project_2");
        });

        it("continues triggering pool matching for remaining pools when one trigger rejects", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const candidates = [
                {
                    matchPoolId: "pool_1",
                    projectId: "project_1",
                    gameModeId: "mode_1",
                    environment: "production",
                    regionKey: "global",
                },
                {
                    matchPoolId: "pool_2",
                    projectId: "project_2",
                    gameModeId: "mode_2",
                    environment: "production",
                    regionKey: "global",
                },
            ];
            const prismaService = {
                client: { $queryRaw: jest.fn().mockResolvedValue(candidates) },
            } as unknown as PrismaService;
            const queuesService = {
                triggerPoolMatching: jest
                    .fn()
                    .mockRejectedValueOnce(new Error("queue full"))
                    .mockResolvedValueOnce(undefined),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            await processor.sweepStalledPools();

            expect(queuesService.triggerPoolMatching).toHaveBeenCalledTimes(2);
        });
    });

    describe("process", () => {
        it("attempts tryCreateMatch and schedules webhook when a match is created", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const prismaService = {
                client: {
                    matchPool: {
                        findUnique: jest.fn().mockResolvedValue({
                            projectId: "project_1",
                            gameModeId: "mode_1",
                            environment: "production",
                            regionKey: "global",
                        }),
                    },
                },
            } as unknown as PrismaService;
            const queuesService = {
                tryCreateMatch: jest.fn().mockResolvedValue("match_1"),
                scheduleMatchCreatedWebhook: jest.fn().mockResolvedValue(undefined),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            const job = {
                data: {
                    matchPoolId: "pool_1",
                    projectId: "project_1",
                },
            } as Job<MatchmakingPoolJobData>;

            await processor.process(job);

            expect(queuesService.tryCreateMatch).toHaveBeenCalledWith("pool_1");
            expect(prismaService.client.matchPool.findUnique).toHaveBeenCalledWith({
                where: { id: "pool_1" },
                select: {
                    projectId: true,
                    gameModeId: true,
                    environment: true,
                    regionKey: true,
                },
            });
            expect(queuesService.scheduleMatchCreatedWebhook).toHaveBeenCalledWith(
                "project_1",
                "match_1",
                "mode_1",
                "production",
                "global",
            );
        });

        it("does not schedule a webhook when tryCreateMatch returns null", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const prismaService = {
                client: {
                    matchPool: {
                        findUnique: jest.fn(),
                    },
                },
            } as unknown as PrismaService;
            const queuesService = {
                tryCreateMatch: jest.fn().mockResolvedValue(null),
                scheduleMatchCreatedWebhook: jest.fn(),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            const job = {
                data: {
                    matchPoolId: "pool_1",
                    projectId: "project_1",
                },
            } as Job<MatchmakingPoolJobData>;

            await processor.process(job);

            expect(queuesService.tryCreateMatch).toHaveBeenCalledWith("pool_1");
            expect(prismaService.client.matchPool.findUnique).not.toHaveBeenCalled();
            expect(queuesService.scheduleMatchCreatedWebhook).not.toHaveBeenCalled();
        });

        it("rethrows when tryCreateMatch rejects during job processing", async () => {
            const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
            const prismaService = {
                client: {
                    matchPool: {
                        findUnique: jest.fn(),
                    },
                },
            } as unknown as PrismaService;
            const queuesService = {
                tryCreateMatch: jest.fn().mockRejectedValue(new Error("db connection lost")),
                scheduleMatchCreatedWebhook: jest.fn(),
            } as unknown as QueuesService;
            const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

            const job = {
                data: {
                    matchPoolId: "pool_1",
                    projectId: "project_1",
                },
            } as Job<MatchmakingPoolJobData>;

            await expect(processor.process(job)).rejects.toThrow("db connection lost");
        });
    });
});
