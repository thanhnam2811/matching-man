import { SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { PrismaService } from "../prisma/prisma.service";
import { HealthService } from "./health.service";

function buildService(database: boolean, webhookRetry: string, queueTimeout: string) {
    const prismaService = { isHealthy: jest.fn().mockResolvedValue(database) } as unknown as PrismaService;
    const schedulerHealthService = {
        getStatus: jest.fn((job: string) => (job === "webhook-retry" ? webhookRetry : queueTimeout)),
    } as unknown as SchedulerHealthService;

    return new HealthService(prismaService, schedulerHealthService);
}

describe("HealthService", () => {
    it("reports ok when the database is up and no scheduler job is down", async () => {
        const service = buildService(true, "up", "pending");

        const health = await service.getHealth();

        expect(health.status).toBe("ok");
        expect(health.checks).toEqual({
            database: "up",
            scheduler: { webhookRetry: "up", queueTimeout: "pending" },
        });
    });

    it("reports degraded when the database is down", async () => {
        const service = buildService(false, "up", "up");

        const health = await service.getHealth();

        expect(health.status).toBe("degraded");
        expect(health.checks.database).toBe("down");
    });

    it("reports degraded when a scheduler job is down", async () => {
        const service = buildService(true, "down", "up");

        const health = await service.getHealth();

        expect(health.status).toBe("degraded");
    });

    it("does not treat a pending (never-run-yet) scheduler job as degraded", async () => {
        const service = buildService(true, "pending", "pending");

        const health = await service.getHealth();

        expect(health.status).toBe("ok");
    });
});
