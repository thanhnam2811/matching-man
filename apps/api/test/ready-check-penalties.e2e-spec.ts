import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { buildTestApp } from "./support/build-app";

async function pollForMatchId(
    http: Parameters<typeof request>[0],
    apiKey: string,
    queueEntryId: string,
): Promise<string> {
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
        const res = await request(http)
            .get(`/v1/queues/entries/${queueEntryId}`)
            .set("Authorization", `Bearer ${apiKey}`)
            .expect(200);

        if (res.body.matchId) {
            return res.body.matchId as string;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timed out waiting for a match on queue entry ${queueEntryId}`);
}

jest.setTimeout(15000);

describe("Ready check and player penalties (e2e)", () => {
    let app: INestApplication;
    let http: Parameters<typeof request>[0];

    beforeAll(async () => {
        app = await buildTestApp();
        http = app.getHttpServer() as Parameters<typeof request>[0];
    });

    afterAll(async () => {
        await app.close();
    });

    it("executes full ready check handshake, dodge penalty, lock out, and admin pardon lifecycle", async () => {
        const unique = randomUUID().slice(0, 8);

        // 1. Register owner and create project with dodge penalty enabled
        const regRes = await request(http)
            .post("/v1/auth/register")
            .send({ email: `owner-rc-${unique}@example.test`, password: "correct-horse-battery-staple" })
            .expect(201);
        const sessionToken = regRes.body.token as string;

        const orgRes = await request(http)
            .post("/v1/organizations")
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({ name: `RC Org ${unique}` })
            .expect(201);
        const organizationId = orgRes.body.id as string;

        const projRes = await request(http)
            .post("/v1/projects")
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({
                name: `RC Proj ${unique}`,
                slug: `rc-proj-${unique}`,
                organizationId,
                environments: ["production"],
            })
            .expect(201);
        const projectId = projRes.body.id as string;

        // Configure project penalties
        await request(http)
            .patch(`/v1/projects/${projectId}`)
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({
                enableDodgePenalty: true,
                penaltyTiers: [300, 900],
                penaltyDecayHours: 12,
            })
            .expect(200);

        // Create game mode with ready check enabled (15s timeout)
        const gmRes = await request(http)
            .post(`/v1/projects/${projectId}/game-modes`)
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({
                key: `ranked-rc-${unique}`,
                name: "Ranked ReadyCheck",
                matchStructure: "VERSUS",
                requiredSlots: 2,
                groupCount: 2,
                teamSizeMin: 1,
                teamSizeMax: 1,
                ratingMode: "DISABLED",
                enableReadyCheck: true,
                readyCheckTimeoutSeconds: 15,
            })
            .expect(201);
        const gameModeId = gmRes.body.id as string;

        // Create API key
        const keyRes = await request(http)
            .post(`/v1/projects/${projectId}/api-keys`)
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({ name: "primary" })
            .expect(201);
        const apiKey = keyRes.body.key as string;

        // 2. Enqueue two players to form a match
        const player1 = `player-1-${unique}`;
        const player2 = `player-2-${unique}`;

        await request(http)
            .post("/v1/queues/enqueue")
            .set("Authorization", `Bearer ${apiKey}`)
            .send({
                projectId,
                gameModeId,
                environment: "production",
                team: { members: [{ playerId: player1 }] },
            })
            .expect(201);

        const q2 = await request(http)
            .post("/v1/queues/enqueue")
            .set("Authorization", `Bearer ${apiKey}`)
            .send({
                projectId,
                gameModeId,
                environment: "production",
                team: { members: [{ playerId: player2 }] },
            })
            .expect(201);

        const matchId = await pollForMatchId(http, apiKey, q2.body.queueEntryId as string);
        expect(matchId).toBeDefined();

        // 3. Inspect Ready Check status
        const rcStatus = await request(http)
            .get(`/v1/matches/${matchId}/ready-check`)
            .set("Authorization", `Bearer ${apiKey}`)
            .expect(200);

        expect(rcStatus.body.status).toBe("pending_acceptance");
        expect(rcStatus.body.timeoutSeconds).toBe(15);
        expect(rcStatus.body.slots).toHaveLength(2);

        const slot1 = rcStatus.body.slots[0];
        const slot2 = rcStatus.body.slots[1];

        // 4. Player 1 accepts
        const accept1 = await request(http)
            .post(`/v1/matches/${matchId}/accept`)
            .set("Authorization", `Bearer ${apiKey}`)
            .send({ playerId: player1, teamId: slot1.teamId })
            .expect(201);

        expect(accept1.body.status).toBe("pending_acceptance");
        expect(accept1.body.isComplete).toBe(false);

        // 5. Player 2 declines -> match DECLINED, player 2 penalized
        const decline2 = await request(http)
            .post(`/v1/matches/${matchId}/decline`)
            .set("Authorization", `Bearer ${apiKey}`)
            .send({ playerId: player2, teamId: slot2.teamId, reason: "Player refused ready check" })
            .expect(201);

        expect(decline2.body.status).toBe("declined");
        expect(decline2.body.penaltyApplied).toBe(true);

        // 6. Player 2 tries to enqueue again -> BLOCKED with 403 Forbidden
        const blockedEnqueue = await request(http)
            .post("/v1/queues/enqueue")
            .set("Authorization", `Bearer ${apiKey}`)
            .send({
                projectId,
                gameModeId,
                environment: "production",
                team: { members: [{ playerId: player2 }] },
            })
            .expect(403);

        expect(blockedEnqueue.body.error.message).toContain("locked out from queueing");

        // 7. Project admin views penalties list
        const penaltiesList = await request(http)
            .get(`/v1/projects/${projectId}/penalties`)
            .set("Authorization", `Bearer ${sessionToken}`)
            .expect(200);

        expect(penaltiesList.body.data).toHaveLength(1);
        const penaltyId = penaltiesList.body.data[0].id as string;
        expect(penaltiesList.body.data[0].playerId).toBe(player2);
        expect(penaltiesList.body.data[0].isActive).toBe(true);

        // 8. Admin pardons player 2
        await request(http)
            .delete(`/v1/projects/${projectId}/penalties/${penaltyId}`)
            .set("Authorization", `Bearer ${sessionToken}`)
            .send({ notes: "Pardoned for test" })
            .expect(200);

        // 9. Player 2 can now enqueue successfully!
        await request(http)
            .post("/v1/queues/enqueue")
            .set("Authorization", `Bearer ${apiKey}`)
            .send({
                projectId,
                gameModeId,
                environment: "production",
                team: { members: [{ playerId: player2 }] },
            })
            .expect(201);
    });
});
