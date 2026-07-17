import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./support/build-app";
import { DemoService } from "../src/demo/demo.service";

describe("GET /v1/demo/config (real DB)", () => {
    let app: INestApplication;
    let demo: DemoService;

    beforeAll(async () => {
        app = await buildTestApp();
        demo = app.get(DemoService);
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns the live demo project config after the account is bootstrapped", async () => {
        await demo.reset();

        const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .get("/v1/demo/config")
            .expect(200);

        expect(response.body).toMatchObject({
            environment: "production",
        });
        expect(typeof response.body.projectId).toBe("string");
        expect(typeof response.body.apiKey).toBe("string");
        expect(response.body.apiKey).toMatch(/^mhub_[0-9a-f]{48}$/);
        expect(typeof response.body.gameModes.skill).toBe("string");
        expect(typeof response.body.gameModes.casual).toBe("string");
    });
});
