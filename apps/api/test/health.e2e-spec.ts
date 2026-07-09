import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./support/build-app";

describe("Health (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it("reports database and scheduler checks", async () => {
        const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .get("/health")
            .expect(200);

        expect(response.body).toMatchObject({
            status: "ok",
            checks: {
                database: "up",
                // buildTestApp overrides both @Cron processors with stubs that never
                // call recordRun, so both jobs are correctly reported "pending".
                scheduler: { webhookRetry: "pending", queueTimeout: "pending" },
            },
        });
    });
});
