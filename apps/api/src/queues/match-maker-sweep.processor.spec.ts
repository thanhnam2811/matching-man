import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { PrismaService } from "../prisma/prisma.service";
import { MatchMakerSweepProcessor } from "./match-maker-sweep.processor";
import { QueuesService } from "./queues.service";

describe("MatchMakerSweepProcessor", () => {
    it("records a scheduler run even when the sweep query throws", async () => {
        const schedulerHealthService = { recordRun: jest.fn() } as unknown as SchedulerHealthService;
        const prismaService = {
            client: { $queryRaw: jest.fn().mockRejectedValue(new Error("db down")) },
        } as unknown as PrismaService;
        const queuesService = {
            tryCreateMatch: jest.fn(),
            scheduleMatchCreatedWebhook: jest.fn(),
        } as unknown as QueuesService;
        const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

        await processor.sweepStalledPools();

        expect(schedulerHealthService.recordRun).toHaveBeenCalledWith(SCHEDULER_JOBS.MATCH_MAKER_SWEEP);
    });

    it("attempts tryCreateMatch for every pool with enough queued entries and schedules a webhook when matched", async () => {
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
                projectId: "project_1",
                gameModeId: "mode_2",
                environment: "production",
                regionKey: "global",
            },
        ];
        const prismaService = {
            client: { $queryRaw: jest.fn().mockResolvedValue(candidates) },
        } as unknown as PrismaService;
        const queuesService = {
            tryCreateMatch: jest.fn().mockResolvedValueOnce("match_1").mockResolvedValueOnce(null),
            scheduleMatchCreatedWebhook: jest.fn().mockResolvedValue(undefined),
        } as unknown as QueuesService;
        const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

        await processor.sweepStalledPools();

        expect(queuesService.tryCreateMatch).toHaveBeenNthCalledWith(1, "pool_1");
        expect(queuesService.tryCreateMatch).toHaveBeenNthCalledWith(2, "pool_2");
        expect(queuesService.scheduleMatchCreatedWebhook).toHaveBeenCalledTimes(1);
        expect(queuesService.scheduleMatchCreatedWebhook).toHaveBeenCalledWith(
            "project_1",
            "match_1",
            "mode_1",
            "production",
            "global",
        );
    });

    it("continues sweeping remaining pools when tryCreateMatch rejects for one of them", async () => {
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
                projectId: "project_1",
                gameModeId: "mode_2",
                environment: "production",
                regionKey: "global",
            },
        ];
        const prismaService = {
            client: { $queryRaw: jest.fn().mockResolvedValue(candidates) },
        } as unknown as PrismaService;
        const queuesService = {
            tryCreateMatch: jest.fn().mockRejectedValueOnce(new Error("lock timeout")).mockResolvedValueOnce("match_2"),
            scheduleMatchCreatedWebhook: jest.fn().mockResolvedValue(undefined),
        } as unknown as QueuesService;
        const processor = new MatchMakerSweepProcessor(prismaService, queuesService, schedulerHealthService);

        await processor.sweepStalledPools();

        expect(queuesService.tryCreateMatch).toHaveBeenCalledTimes(2);
        expect(queuesService.scheduleMatchCreatedWebhook).toHaveBeenCalledWith(
            "project_1",
            "match_2",
            "mode_2",
            "production",
            "global",
        );
    });
});
