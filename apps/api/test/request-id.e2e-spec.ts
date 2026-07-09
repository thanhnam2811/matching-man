import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./support/build-app";

describe("Request ID propagation (e2e)", () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it("echoes a client-supplied x-request-id and includes it in the error envelope", async () => {
        const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .post("/v1/auth/login")
            .set("x-request-id", "client-request-id-123")
            .send({ email: "nobody@example.com", password: "wrong-password" })
            .expect(401);

        expect(response.headers["x-request-id"]).toBe("client-request-id-123");
        expect(response.body).toMatchObject({
            success: false,
            requestId: "client-request-id-123",
        });
    });

    it("generates an x-request-id when the client sends none", async () => {
        const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
            .post("/v1/auth/login")
            .send({ email: "nobody@example.com", password: "wrong-password" })
            .expect(401);

        expect(response.headers["x-request-id"]).toBeTruthy();
        expect(response.body.requestId).toBe(response.headers["x-request-id"]);
    });
});
