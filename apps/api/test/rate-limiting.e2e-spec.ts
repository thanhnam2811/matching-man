import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import helmet from "helmet";
import request from "supertest";
import { ConfigService } from "@nestjs/config";
import { ThrottlerStorage } from "@nestjs/throttler";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE } from "../src/swagger";
import { WebhookRetryProcessor } from "../src/deliveries/webhook-retry.processor";
import { QueueTimeoutProcessor } from "../src/queues/queue-timeout.processor";

const mockGet = (key: string): unknown => {
    if (key === "THROTTLE_LIMIT") return 2;
    if (key === "THROTTLE_TTL_MS") return 60000;
    if (key === "AUTH_THROTTLE_LIMIT") return 10;
    if (key === "AUTH_THROTTLE_TTL_MS") return 60000;
    if (key === "REQUEST_BODY_LIMIT_KB") return 256;
    if (key === "PORT") return 3000;
    if (key === "NODE_ENV") return "test";
    return process.env[key];
};

describe("Rate limiting (e2e)", () => {
    let app: INestApplication;
    let storageService: ThrottlerStorage;

    beforeAll(async () => {
        process.env.NODE_ENV = "test";
        process.env.DATABASE_URL = "postgresql://admin:password@127.0.0.1:5432/matching_hub?schema=public";
        process.env.DASHBOARD_ADMIN_TOKEN = "test-dashboard-token";
        process.env.SESSION_SECRET = "test-secret-test-secret-test-secret";

        const mockConfigService = {
            get: mockGet,
            getOrThrow: (key: string) => {
                const val = mockGet(key);
                if (val === undefined) throw new Error(`${key} not found`);
                return val;
            },
        };

        const moduleFixture = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(ConfigService)
            .useValue(mockConfigService)
            .overrideProvider(WebhookRetryProcessor)
            .useValue({ processPendingDeliveries: async () => {} })
            .overrideProvider(QueueTimeoutProcessor)
            .useValue({ processTimedOutEntries: async () => {} })
            .compile();

        app = moduleFixture.createNestApplication<NestExpressApplication>();
        const bodyLimit = `${process.env.REQUEST_BODY_LIMIT_KB ?? 256}kb`;
        app.useBodyParser("json", { limit: bodyLimit });
        app.useBodyParser("urlencoded", { limit: bodyLimit, extended: true });
        app.use(helmet());
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
        app.useGlobalFilters(new GlobalExceptionFilter());
        app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });

        await app.init();
        storageService = app.get<ThrottlerStorage>(ThrottlerStorage);
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    beforeEach(() => {
        if (storageService) (storageService as any).storage.clear();
    });

    it("returns 429 in the standard error envelope once the per-IP limit is exceeded", async () => {
        const server = app.getHttpServer() as Parameters<typeof request>[0];

        await request(server).get("/v1/auth/contract").expect(200);
        await request(server).get("/v1/auth/contract").expect(200);

        const blocked = await request(server).get("/v1/auth/contract").expect(429);

        expect(blocked.body).toMatchObject({
            success: false,
            error: {
                statusCode: 429,
                code: "TOO_MANY_REQUESTS",
            },
        });
    });

    it("applies the stricter auth-route limit to POST /v1/auth/login", async () => {
        const server = app.getHttpServer() as Parameters<typeof request>[0];

        const ipTracker = "::ffff:127.0.0.1";
        const key = require("crypto")
            .createHash("sha256")
            .update(`AuthController-login-default-${ipTracker}`)
            .digest("hex");

        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");
        await storageService.increment(key, 60000, 10, 60000, "default");

        const blocked = await request(server)
            .post("/v1/auth/login")
            .send({ email: "nobody@example.com", password: "wrong-password" })
            .expect(429);

        expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");
    });
});
