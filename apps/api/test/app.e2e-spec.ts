import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("AppController (e2e)", () => {
    let app: INestApplication;

    beforeEach(async () => {
        process.env.NODE_ENV = "test";
        process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/matching_hub?schema=public";
        process.env.DASHBOARD_ADMIN_TOKEN = "test-dashboard-token";

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(PrismaService)
            .useValue({
                onModuleInit: jest.fn(),
                onModuleDestroy: jest.fn(),
                isHealthy: jest.fn().mockResolvedValue(true),
            })
            .compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it("/ (GET)", () => {
        return request(app.getHttpServer() as Parameters<typeof request>[0])
            .get("/")
            .expect(200)
            .expect({
                service: "matching-hub-api",
                environment: "test",
                version: "phase-2",
            });
    });

    it("blocks control-plane routes without dashboard token", () => {
        return request(app.getHttpServer() as Parameters<typeof request>[0])
            .get("/projects")
            .expect(401);
    });

    afterEach(async () => {
        await app.close();
    });
});