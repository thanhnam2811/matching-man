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
        // Gửi JSON body dưới giới hạn lên route GET /v1/auth/contract (sử dụng method POST).
        // Vì body hợp lệ, Express body-parser cho qua và đi tiếp. Method POST lên route GET
        // sẽ bị NestJS chặn ở tầng routing trả về 404 (hoặc 405 Method Not Allowed), chứ không bị 413.
        const res = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .post("/v1/auth/contract")
            .send({ data: "short-data" });

        expect(res.status).not.toBe(413);
    });
});
