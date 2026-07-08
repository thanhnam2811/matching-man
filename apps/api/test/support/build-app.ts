import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { GlobalExceptionFilter } from "../../src/common/filters/global-exception.filter";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE } from "../../src/swagger";

/**
 * Boots the real Nest app (real Prisma/Postgres, no mocked providers) with the same
 * pipes/filters/prefix as `main.ts`, so requests behave like production. Requires
 * DATABASE_URL to point at a Postgres instance with migrations already applied
 * (see docker-compose.yml / CI's `prisma migrate deploy` step).
 */
export async function buildTestApp(): Promise<INestApplication> {
    process.env.NODE_ENV ??= "test";
    process.env.DATABASE_URL ??= "postgresql://admin:password@127.0.0.1:5432/matching_hub?schema=public";
    process.env.DASHBOARD_ADMIN_TOKEN ??= "test-dashboard-token";
    process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret";

    const moduleFixture = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });
    await app.init();

    return app;
}
