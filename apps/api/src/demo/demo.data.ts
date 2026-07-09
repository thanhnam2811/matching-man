import { createId } from "@paralleldrive/cuid2";
import { MatchStatus, Prisma, QueueEntryStatus, RatingMode, WebhookDeliveryStatus } from "../generated/prisma/client";
import { DEMO_ENVIRONMENT, DEMO_REGION_KEY } from "./demo.constants";

// Resolved identifiers the service looks up (or creates) before building the
// snapshot, so this builder stays a pure function of its inputs.
export type DemoSnapshotContext = {
    now: Date;
    skillGameModeId: string;
    casualGameModeId: string;
    skillPoolId: string;
    casualPoolId: string;
    webhookEndpointId: string;
};

export type DemoSnapshot = {
    teams: Array<{ id: string; projectId?: never; externalTeamId: string | null }>;
    teamMembers: Array<{ id: string; teamId: string; playerId: string; ratingSnapshot: number | null }>;
    queueEntries: Array<{
        id: string;
        gameModeId: string;
        matchPoolId: string;
        teamId: string;
        environment: string;
        regionKey: string;
        ratingMode: RatingMode;
        status: QueueEntryStatus;
        idempotencyKey: string;
        queuedAt: Date;
        matchedAt: Date | null;
    }>;
    matches: Array<{
        id: string;
        gameModeId: string;
        matchPoolId: string;
        environment: string;
        regionKey: string;
        status: MatchStatus;
        ratingMode: RatingMode;
        requiredSlots: number;
        groupCount: number;
        createdAt: Date;
    }>;
    matchSlots: Array<{
        id: string;
        matchId: string;
        queueEntryId: string;
        teamId: string;
        slotIndex: number;
        groupIndex: number;
        teamSnapshot: Array<{ playerId: string; rating: number | null }>;
    }>;
    matchResults: Array<{ id: string; matchId: string; winnerGroupIndex: number; endedAt: Date }>;
    ratingProfiles: Array<{ id: string; gameModeId: string; playerId: string; rating: number; gamesPlayed: number }>;
    ratingHistory: Array<{
        id: string;
        ratingProfileId: string;
        matchId: string;
        ratingBefore: number;
        ratingAfter: number;
        delta: number;
        createdAt: Date;
    }>;
    webhookDeliveries: Array<{
        id: string;
        eventType: string;
        payload: Prisma.InputJsonValue;
        status: WebhookDeliveryStatus;
        attemptCount: number;
        lastAttemptAt: Date | null;
        lastResponseCode: number | null;
        lastError: string | null;
        nextRetryAt: Date | null;
        exhaustedAt: Date | null;
        createdAt: Date;
    }>;
};

const START_RATING = 1200;

// Chronological ranked matches (oldest first). `winner` names which side won so
// the running-rating chain stays internally consistent across reseeds.
const RANKED_MATCHES: Array<{ a: string; b: string; winner: "a" | "b"; delta: number }> = [
    { a: "demo_alina", b: "demo_bruno", winner: "a", delta: 16 },
    { a: "demo_cira", b: "demo_dmitri", winner: "b", delta: 14 },
    { a: "demo_alina", b: "demo_cira", winner: "a", delta: 12 },
    { a: "demo_esen", b: "demo_faye", winner: "a", delta: 18 },
    { a: "demo_bruno", b: "demo_dmitri", winner: "b", delta: 15 },
];

const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000);

/**
 * Builds a self-contained, internally consistent snapshot of showcase activity
 * for the demo project: completed ranked matches with rating history, a couple
 * of live (in-queue and just-matched) entries, and a spread of webhook
 * deliveries. Pure — every foreign key it emits points at a row it also emits
 * (or at an id supplied in the context).
 */
export function buildDemoSnapshot(ctx: DemoSnapshotContext): DemoSnapshot {
    const snapshot: DemoSnapshot = {
        teams: [],
        teamMembers: [],
        queueEntries: [],
        matches: [],
        matchSlots: [],
        matchResults: [],
        ratingProfiles: [],
        ratingHistory: [],
        webhookDeliveries: [],
    };

    // Running rating per player, plus the profile row id so history can link to it.
    const ratings = new Map<string, number>();
    const gamesPlayed = new Map<string, number>();
    const profileId = new Map<string, string>();

    const ensureProfile = (playerId: string) => {
        let id = profileId.get(playerId);
        if (!id) {
            id = createId();
            profileId.set(playerId, id);
            ratings.set(playerId, START_RATING);
            gamesPlayed.set(playerId, 0);
        }
        return id;
    };

    // One matched queue entry + its single-member team for a completed/live match.
    const addParticipant = (
        gameModeId: string,
        poolId: string,
        ratingMode: RatingMode,
        playerId: string,
        rating: number | null,
        queuedAt: Date,
        matchedAt: Date | null,
        status: QueueEntryStatus,
    ) => {
        const teamId = createId();
        const queueEntryId = createId();
        snapshot.teams.push({ id: teamId, externalTeamId: null });
        snapshot.teamMembers.push({ id: createId(), teamId, playerId, ratingSnapshot: rating });
        snapshot.queueEntries.push({
            id: queueEntryId,
            gameModeId,
            matchPoolId: poolId,
            teamId,
            environment: DEMO_ENVIRONMENT,
            regionKey: DEMO_REGION_KEY,
            ratingMode,
            status,
            idempotencyKey: `demo-seed-${queueEntryId}`,
            queuedAt,
            matchedAt,
        });
        return { teamId, queueEntryId };
    };

    // --- Completed ranked matches -----------------------------------------
    RANKED_MATCHES.forEach((spec, index) => {
        const endedAt = minutesAgo(ctx.now, (RANKED_MATCHES.length - index) * 45 + 30);
        const createdAt = minutesAgo(endedAt, 4);

        const profileA = ensureProfile(spec.a);
        const profileB = ensureProfile(spec.b);
        const beforeA = ratings.get(spec.a)!;
        const beforeB = ratings.get(spec.b)!;
        const deltaA = spec.winner === "a" ? spec.delta : -spec.delta;
        const deltaB = -deltaA;
        const afterA = beforeA + deltaA;
        const afterB = beforeB + deltaB;

        const matchId = createId();
        const partA = addParticipant(
            ctx.skillGameModeId,
            ctx.skillPoolId,
            RatingMode.EXTERNAL_RATING,
            spec.a,
            beforeA,
            createdAt,
            createdAt,
            QueueEntryStatus.MATCHED,
        );
        const partB = addParticipant(
            ctx.skillGameModeId,
            ctx.skillPoolId,
            RatingMode.EXTERNAL_RATING,
            spec.b,
            beforeB,
            createdAt,
            createdAt,
            QueueEntryStatus.MATCHED,
        );

        snapshot.matches.push({
            id: matchId,
            gameModeId: ctx.skillGameModeId,
            matchPoolId: ctx.skillPoolId,
            environment: DEMO_ENVIRONMENT,
            regionKey: DEMO_REGION_KEY,
            status: MatchStatus.COMPLETED,
            ratingMode: RatingMode.EXTERNAL_RATING,
            requiredSlots: 2,
            groupCount: 2,
            createdAt,
        });
        snapshot.matchSlots.push(
            {
                id: createId(),
                matchId,
                queueEntryId: partA.queueEntryId,
                teamId: partA.teamId,
                slotIndex: 1,
                groupIndex: 1,
                teamSnapshot: [{ playerId: spec.a, rating: beforeA }],
            },
            {
                id: createId(),
                matchId,
                queueEntryId: partB.queueEntryId,
                teamId: partB.teamId,
                slotIndex: 2,
                groupIndex: 2,
                teamSnapshot: [{ playerId: spec.b, rating: beforeB }],
            },
        );
        snapshot.matchResults.push({
            id: createId(),
            matchId,
            winnerGroupIndex: spec.winner === "a" ? 1 : 2,
            endedAt,
        });
        snapshot.ratingHistory.push(
            {
                id: createId(),
                ratingProfileId: profileA,
                matchId,
                ratingBefore: beforeA,
                ratingAfter: afterA,
                delta: deltaA,
                createdAt: endedAt,
            },
            {
                id: createId(),
                ratingProfileId: profileB,
                matchId,
                ratingBefore: beforeB,
                ratingAfter: afterB,
                delta: deltaB,
                createdAt: endedAt,
            },
        );

        ratings.set(spec.a, afterA);
        ratings.set(spec.b, afterB);
        gamesPlayed.set(spec.a, gamesPlayed.get(spec.a)! + 1);
        gamesPlayed.set(spec.b, gamesPlayed.get(spec.b)! + 1);
    });

    for (const [playerId, id] of profileId) {
        snapshot.ratingProfiles.push({
            id,
            gameModeId: ctx.skillGameModeId,
            playerId,
            rating: ratings.get(playerId)!,
            gamesPlayed: gamesPlayed.get(playerId)!,
        });
    }

    // --- Live: a just-formed skill match ----------------------------------
    const liveCreatedAt = minutesAgo(ctx.now, 2);
    const liveMatchId = createId();
    const liveA = addParticipant(
        ctx.skillGameModeId,
        ctx.skillPoolId,
        RatingMode.EXTERNAL_RATING,
        "demo_live_1",
        1218,
        liveCreatedAt,
        liveCreatedAt,
        QueueEntryStatus.MATCHED,
    );
    const liveB = addParticipant(
        ctx.skillGameModeId,
        ctx.skillPoolId,
        RatingMode.EXTERNAL_RATING,
        "demo_live_2",
        1242,
        liveCreatedAt,
        liveCreatedAt,
        QueueEntryStatus.MATCHED,
    );
    snapshot.matches.push({
        id: liveMatchId,
        gameModeId: ctx.skillGameModeId,
        matchPoolId: ctx.skillPoolId,
        environment: DEMO_ENVIRONMENT,
        regionKey: DEMO_REGION_KEY,
        status: MatchStatus.CREATED,
        ratingMode: RatingMode.EXTERNAL_RATING,
        requiredSlots: 2,
        groupCount: 2,
        createdAt: liveCreatedAt,
    });
    snapshot.matchSlots.push(
        {
            id: createId(),
            matchId: liveMatchId,
            queueEntryId: liveA.queueEntryId,
            teamId: liveA.teamId,
            slotIndex: 1,
            groupIndex: 1,
            teamSnapshot: [{ playerId: "demo_live_1", rating: 1218 }],
        },
        {
            id: createId(),
            matchId: liveMatchId,
            queueEntryId: liveB.queueEntryId,
            teamId: liveB.teamId,
            slotIndex: 2,
            groupIndex: 2,
            teamSnapshot: [{ playerId: "demo_live_2", rating: 1242 }],
        },
    );

    // --- Live: a casual match forming from two waiting players -------------
    const casualCreatedAt = minutesAgo(ctx.now, 1);
    const casualMatchId = createId();
    const casualA = addParticipant(
        ctx.casualGameModeId,
        ctx.casualPoolId,
        RatingMode.DISABLED,
        "demo_casual_1",
        null,
        casualCreatedAt,
        casualCreatedAt,
        QueueEntryStatus.MATCHED,
    );
    const casualB = addParticipant(
        ctx.casualGameModeId,
        ctx.casualPoolId,
        RatingMode.DISABLED,
        "demo_casual_2",
        null,
        casualCreatedAt,
        casualCreatedAt,
        QueueEntryStatus.MATCHED,
    );
    snapshot.matches.push({
        id: casualMatchId,
        gameModeId: ctx.casualGameModeId,
        matchPoolId: ctx.casualPoolId,
        environment: DEMO_ENVIRONMENT,
        regionKey: DEMO_REGION_KEY,
        status: MatchStatus.CREATED,
        ratingMode: RatingMode.DISABLED,
        requiredSlots: 2,
        groupCount: 2,
        createdAt: casualCreatedAt,
    });
    snapshot.matchSlots.push(
        {
            id: createId(),
            matchId: casualMatchId,
            queueEntryId: casualA.queueEntryId,
            teamId: casualA.teamId,
            slotIndex: 1,
            groupIndex: 1,
            teamSnapshot: [{ playerId: "demo_casual_1", rating: null }],
        },
        {
            id: createId(),
            matchId: casualMatchId,
            queueEntryId: casualB.queueEntryId,
            teamId: casualB.teamId,
            slotIndex: 2,
            groupIndex: 2,
            teamSnapshot: [{ playerId: "demo_casual_2", rating: null }],
        },
    );

    // --- Live: one skill player still waiting for an opponent --------------
    addParticipant(
        ctx.skillGameModeId,
        ctx.skillPoolId,
        RatingMode.EXTERNAL_RATING,
        "demo_waiting_1",
        1500,
        minutesAgo(ctx.now, 3),
        null,
        QueueEntryStatus.QUEUED,
    );

    // --- Webhook deliveries (one per status, so the tab shows the spread) ---
    const delivery = (
        eventType: string,
        status: WebhookDeliveryStatus,
        overrides: Partial<DemoSnapshot["webhookDeliveries"][number]>,
    ) => {
        snapshot.webhookDeliveries.push({
            id: createId(),
            eventType,
            payload: { event: eventType, matchId: liveMatchId, environment: DEMO_ENVIRONMENT },
            status,
            attemptCount: 1,
            lastAttemptAt: null,
            lastResponseCode: null,
            lastError: null,
            nextRetryAt: null,
            exhaustedAt: null,
            createdAt: minutesAgo(ctx.now, 20),
            ...overrides,
        });
    };

    delivery("match.created", WebhookDeliveryStatus.DELIVERED, {
        lastAttemptAt: minutesAgo(ctx.now, 20),
        lastResponseCode: 200,
        createdAt: minutesAgo(ctx.now, 20),
    });
    delivery("match.completed", WebhookDeliveryStatus.DELIVERED, {
        lastAttemptAt: minutesAgo(ctx.now, 15),
        lastResponseCode: 200,
        createdAt: minutesAgo(ctx.now, 15),
    });
    delivery("queue.timeout", WebhookDeliveryStatus.FAILED, {
        attemptCount: 2,
        lastAttemptAt: minutesAgo(ctx.now, 8),
        lastResponseCode: 503,
        lastError: "503 Service Unavailable",
        nextRetryAt: minutesAgo(ctx.now, -5),
        createdAt: minutesAgo(ctx.now, 10),
    });
    delivery("match.created", WebhookDeliveryStatus.PENDING, {
        attemptCount: 0,
        createdAt: minutesAgo(ctx.now, 1),
    });
    delivery("match.completed", WebhookDeliveryStatus.EXHAUSTED, {
        attemptCount: 6,
        lastAttemptAt: minutesAgo(ctx.now, 40),
        lastResponseCode: 500,
        lastError: "500 Internal Server Error",
        exhaustedAt: minutesAgo(ctx.now, 40),
        createdAt: minutesAgo(ctx.now, 90),
    });

    return snapshot;
}
