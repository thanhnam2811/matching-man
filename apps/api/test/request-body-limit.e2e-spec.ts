import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./support/build-app";

describe("Request body size limit (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it("rejects a JSON body larger than REQUEST_BODY_LIMIT_KB with 413", async () => {
        const oversizedPassword = "x".repeat(300 * 1024); // 300kb, over the 256kb default

        await request(app.getHttpServer() as Parameters<typeof request>[0])
            .post("/v1/auth/contract")
            .send({ data: oversizedPassword })
            .expect(413);
    });

    it("accepts a JSON body under the limit", async () => {
        // POSTs to /v1/auth/contract (a GET-only route) with a body under the limit.
        // body-parser accepts it and passes through; NestJS's router then rejects the
        // method itself (404/405), so the assertion only cares that it isn't 413.
        const res = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .post("/v1/auth/contract")
            .send({ data: "short-data" });

        expect(res.status).not.toBe(413);
    });
});
