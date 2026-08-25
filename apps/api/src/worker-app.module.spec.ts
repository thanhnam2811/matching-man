process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://admin:password@127.0.0.1:5432/matching_hub?schema=public";
process.env.DASHBOARD_ADMIN_TOKEN ??= "test-dashboard-token";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";

import { Test, TestingModule } from "@nestjs/testing";
import { WorkerAppModule } from "./worker-app.module";
import { QueueTimeoutProcessor } from "./queues/queue-timeout.processor";
import { MatchMakerSweepProcessor } from "./queues/match-maker-sweep.processor";
import { WebhookDeliveryProcessor } from "./deliveries/webhook-delivery.processor";
import { WebhookRetryProcessor } from "./deliveries/webhook-retry.processor";
import { DemoResetProcessor } from "./demo/demo-reset.processor";
import { PrismaService } from "./prisma/prisma.service";
import { RedisService } from "./common/redis/redis.service";

describe("WorkerAppModule", () => {
    let moduleRef: TestingModule;

    beforeEach(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [WorkerAppModule],
        }).compile();
    });

    afterAll(async () => {
        if (moduleRef) {
            await moduleRef.close();
        }
    });

    it("should compile the worker application module successfully", () => {
        expect(moduleRef).toBeDefined();
        expect(moduleRef.get(WorkerAppModule)).toBeInstanceOf(WorkerAppModule);
    });

    it("should provide background worker processors and services", () => {
        expect(moduleRef.get(QueueTimeoutProcessor)).toBeDefined();
        expect(moduleRef.get(MatchMakerSweepProcessor)).toBeDefined();
        expect(moduleRef.get(WebhookDeliveryProcessor)).toBeDefined();
        expect(moduleRef.get(WebhookRetryProcessor)).toBeDefined();
        expect(moduleRef.get(DemoResetProcessor)).toBeDefined();
        expect(moduleRef.get(PrismaService)).toBeDefined();
        expect(moduleRef.get(RedisService)).toBeDefined();
    });
});
