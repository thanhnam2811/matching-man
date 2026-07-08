import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import request from "supertest";

type MatchmakingFixture = {
    sessionToken: string;
    organizationId: string;
    projectId: string;
    gameModeId: string;
    apiKey: string;
};

/**
 * Registers a fresh dashboard user, org, project (with a "production" environment),
 * and a VERSUS/INTERNAL_ELO game mode, then issues a project API key. Every run uses
 * randomized emails/slugs so it's safe to repeat against a persistent local Postgres.
 */
export async function createMatchmakingFixture(app: INestApplication): Promise<MatchmakingFixture> {
    const http = app.getHttpServer() as Parameters<typeof request>[0];
    const unique = randomUUID().slice(0, 8);

    const registerRes = await request(http)
        .post("/v1/auth/register")
        .send({ email: `owner-${unique}@example.test`, password: "correct-horse-battery-staple" })
        .expect(201);
    const sessionToken = registerRes.body.token as string;

    const orgRes = await request(http)
        .post("/v1/organizations")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ name: `Fixture Org ${unique}` })
        .expect(201);
    const organizationId = orgRes.body.id as string;

    const projectRes = await request(http)
        .post("/v1/projects")
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
            name: `Fixture Project ${unique}`,
            slug: `fixture-project-${unique}`,
            organizationId,
            environments: ["production"],
        })
        .expect(201);
    const projectId = projectRes.body.id as string;

    const gameModeRes = await request(http)
        .post(`/v1/projects/${projectId}/game-modes`)
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({
            key: `ranked-1v1-${unique}`,
            name: "Ranked 1v1",
            matchStructure: "VERSUS",
            requiredSlots: 2,
            groupCount: 2,
            teamSizeMin: 1,
            teamSizeMax: 1,
            ratingMode: "INTERNAL_ELO",
        })
        .expect(201);
    const gameModeId = gameModeRes.body.id as string;

    const apiKeyRes = await request(http)
        .post(`/v1/projects/${projectId}/api-keys`)
        .set("Authorization", `Bearer ${sessionToken}`)
        .send({ name: "e2e test key" })
        .expect(201);
    const apiKey = apiKeyRes.body.key as string;

    return { sessionToken, organizationId, projectId, gameModeId, apiKey };
}
