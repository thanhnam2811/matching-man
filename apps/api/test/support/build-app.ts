import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import helmet from "helmet";
import { AppModule } from "../../src/app.module";
import { getBodyLimitKb } from "../../src/common/utils/body-limit.util";
import { GlobalExceptionFilter } from "../../src/common/filters/global-exception.filter";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE } from "../../src/swagger";
import { WebhookRetryProcessor } from "../../src/deliveries/webhook-retry.processor";
import { QueueTimeoutProcessor } from "../../src/queues/queue-timeout.processor";
import { MatchMakerSweepProcessor } from "../../src/queues/match-maker-sweep.processor";

/**
 * Boots the real Nest app (real Prisma/Postgres, no mocked providers) with the same
 * pipes/filters/prefix as `main.ts`, so requests behave like production. Requires
 * DATABASE_URL to point at a Postgres instance with migrations already applied
 * (see docker-compose.yml / CI's `prisma migrate deploy` step).
 *
 * The real `@Cron` processors are disabled: they'd otherwise fire on their own
 * wall-clock schedule during a test and race with a test's own explicit calls
 * to `WebhookDeliveryService.sendPendingDeliveries()` (double-processing the
 * same rows), making assertions on delivery counts/state flaky.
 */
export async function buildTestApp(): Promise<INestApplication> {
    process.env.NODE_ENV ??= "test";
    process.env.DATABASE_URL ??= "postgresql://admin:password@127.0.0.1:5432/matching_hub?schema=public";
    process.env.DASHBOARD_ADMIN_TOKEN ??= "test-dashboard-token";
    process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";

    const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
    })
        .overrideProvider(WebhookRetryProcessor)
        .useValue({ processPendingDeliveries: async () => {} })
        .overrideProvider(QueueTimeoutProcessor)
        .useValue({ processTimedOutEntries: async () => {} })
        .overrideProvider(MatchMakerSweepProcessor)
        .useValue({ sweepStalledPools: async () => {} })
        .compile();

    const app = moduleFixture.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    app.useLogger(app.get(PinoLogger));
    app.use(helmet());
    const bodyLimit = getBodyLimitKb();
    app.useBodyParser("json", { limit: bodyLimit });
    app.useBodyParser("urlencoded", { limit: bodyLimit, extended: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });
    await app.init();

    return app;
}
