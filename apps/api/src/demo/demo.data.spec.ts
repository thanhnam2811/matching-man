import { MatchStatus, QueueEntryStatus } from "../generated/prisma/client";
import { buildDemoSnapshot } from "./demo.data";

describe("buildDemoSnapshot", () => {
    const ctx = {
        now: new Date("2026-07-09T12:00:00.000Z"),
        skillGameModeId: "gm_skill",
        casualGameModeId: "gm_casual",
        skillPoolId: "pool_skill",
        casualPoolId: "pool_casual",
        webhookEndpointId: "wh_endpoint",
    };

    it("is referentially consistent: every foreign key points at an emitted row", () => {
        const s = buildDemoSnapshot(ctx);

        const teamIds = new Set(s.teams.map((t) => t.id));
        const matchIds = new Set(s.matches.map((m) => m.id));
        const queueEntryIds = new Set(s.queueEntries.map((q) => q.id));
        const profileIds = new Set(s.ratingProfiles.map((p) => p.id));

        for (const member of s.teamMembers) expect(teamIds.has(member.teamId)).toBe(true);
        for (const entry of s.queueEntries) expect(teamIds.has(entry.teamId)).toBe(true);
        for (const slot of s.matchSlots) {
            expect(matchIds.has(slot.matchId)).toBe(true);
            expect(queueEntryIds.has(slot.queueEntryId)).toBe(true);
            expect(teamIds.has(slot.teamId)).toBe(true);
        }
        for (const result of s.matchResults) expect(matchIds.has(result.matchId)).toBe(true);
        for (const history of s.ratingHistory) {
            expect(profileIds.has(history.ratingProfileId)).toBe(true);
            expect(matchIds.has(history.matchId)).toBe(true);
        }
    });

    it("gives each match slot a unique queue entry (satisfies the DB unique)", () => {
        const s = buildDemoSnapshot(ctx);
        const slotQueueEntryIds = s.matchSlots.map((slot) => slot.queueEntryId);
        expect(new Set(slotQueueEntryIds).size).toBe(slotQueueEntryIds.length);
    });

    it("keeps rating history internally consistent (after = before + delta, zero-sum per match)", () => {
        const s = buildDemoSnapshot(ctx);

        for (const history of s.ratingHistory) {
            expect(history.ratingAfter).toBe(history.ratingBefore + history.delta);
        }

        const deltaByMatch = new Map<string, number>();
        for (const history of s.ratingHistory) {
            deltaByMatch.set(history.matchId, (deltaByMatch.get(history.matchId) ?? 0) + history.delta);
        }
        for (const total of deltaByMatch.values()) expect(total).toBe(0);
    });

    it("seeds completed matches, a live match, and a waiting queue entry", () => {
        const s = buildDemoSnapshot(ctx);

        expect(s.matches.some((m) => m.status === MatchStatus.COMPLETED)).toBe(true);
        expect(s.matches.some((m) => m.status === MatchStatus.CREATED)).toBe(true);
        expect(s.queueEntries.some((q) => q.status === QueueEntryStatus.QUEUED)).toBe(true);
        expect(s.queueEntries.some((q) => q.status === QueueEntryStatus.MATCHED)).toBe(true);

        // Every completed match has exactly two slots and a result.
        const completed = s.matches.filter((m) => m.status === MatchStatus.COMPLETED);
        for (const match of completed) {
            expect(s.matchSlots.filter((slot) => slot.matchId === match.id)).toHaveLength(2);
            expect(s.matchResults.filter((r) => r.matchId === match.id)).toHaveLength(1);
        }
    });

    it("covers all four webhook delivery statuses for the dashboard", () => {
        const s = buildDemoSnapshot(ctx);
        const statuses = new Set(s.webhookDeliveries.map((d) => d.status));
        expect(statuses.size).toBeGreaterThanOrEqual(4);
    });
});
