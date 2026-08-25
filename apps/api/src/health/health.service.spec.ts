import { SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { HealthService } from "./health.service";

function buildService(
    database: boolean,
    redis: boolean,
    webhookRetry: string,
    queueTimeout: string,
    matchMakerSweep?: string,
) {
    const prismaService = { isHealthy: jest.fn().mockResolvedValue(database) } as unknown as PrismaService;
    const redisService = { isHealthy: jest.fn().mockResolvedValue(redis) } as unknown as RedisService;
    const schedulerHealthService = {
        getStatus: jest.fn(
            (job: string) =>
                ({
                    "webhook-retry": webhookRetry,
                    "queue-timeout": queueTimeout,
                    "match-maker-sweep": matchMakerSweep ?? "pending",
                })[job] ?? queueTimeout,
        ),
    } as unknown as SchedulerHealthService;

    return new HealthService(prismaService, redisService, schedulerHealthService);
}

describe("HealthService", () => {
    it("reports ok when the database and redis are up and no scheduler job is down", async () => {
        const service = buildService(true, true, "up", "pending");

        const health = await service.getHealth();

        expect(health.status).toBe("ok");
        expect(health.checks).toEqual({
            database: "up",
            redis: "up",
            scheduler: { webhookRetry: "up", queueTimeout: "pending", matchMakerSweep: "pending" },
        });
    });

    it("reports degraded when the database is down", async () => {
        const service = buildService(false, true, "up", "up");

        const health = await service.getHealth();

        expect(health.status).toBe("degraded");
        expect(health.checks.database).toBe("down");
        expect(health.checks.redis).toBe("up");
    });

    it("reports degraded when redis is down", async () => {
        const service = buildService(true, false, "up", "up");

        const health = await service.getHealth();

        expect(health.status).toBe("degraded");
        expect(health.checks.database).toBe("up");
        expect(health.checks.redis).toBe("down");
    });

    it("reports degraded when a scheduler job is down", async () => {
        const service = buildService(true, true, "down", "up");

        const health = await service.getHealth();

        expect(health.status).toBe("degraded");
    });

    it("does not treat a pending (never-run-yet) scheduler job as degraded", async () => {
        const service = buildService(true, true, "pending", "pending");

        const health = await service.getHealth();

        expect(health.status).toBe("ok");
    });
});
