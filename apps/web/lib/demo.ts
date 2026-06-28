// Server-only helpers for the public /demo page. They call the matchmaking API with a
// seeded demo project's API key (held in env, never sent to the browser).

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/v1";
const DEMO_API_KEY = process.env.DEMO_API_KEY;
const DEMO_PROJECT_ID = process.env.DEMO_PROJECT_ID;
const DEMO_ENVIRONMENT = process.env.DEMO_ENVIRONMENT ?? "production";

const GAME_MODES: Record<DemoMode, string | undefined> = {
    skill: process.env.DEMO_GAME_MODE_SKILL,
    casual: process.env.DEMO_GAME_MODE_CASUAL,
};

export type DemoMode = "skill" | "casual";

export function isDemoEnabled() {
    return Boolean(DEMO_API_KEY && DEMO_PROJECT_ID && GAME_MODES.skill && GAME_MODES.casual);
}

async function demoFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEMO_API_KEY}`, ...init?.headers },
        cache: "no-store",
    });

    if (!response.ok) {
        throw new Error(`demo api ${path} -> ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export type DemoEnqueueResult = {
    queueEntryId: string;
    status: string;
    matchId: string | null;
    playerId: string;
    rating: number;
    mode: DemoMode;
};

export async function demoEnqueue(mode: DemoMode, rating: number): Promise<DemoEnqueueResult> {
    const gameModeId = GAME_MODES[mode];
    const playerId = `p_${Math.random().toString(36).slice(2, 8)}`;

    const result = await demoFetch<{ queueEntryId: string; status: string; matchId: string | null }>(
        "/queues/enqueue",
        {
            method: "POST",
            body: JSON.stringify({
                projectId: DEMO_PROJECT_ID,
                gameModeId,
                environment: DEMO_ENVIRONMENT,
                team: { members: [{ playerId, rating }] },
            }),
        },
    );

    return { ...result, playerId, rating, mode };
}

export type DemoMatch = {
    id: string;
    status: string;
    slots: { slotIndex: number; groupIndex: number; members: { playerId: string; rating: number | null }[] }[];
};

export function demoMatch(matchId: string) {
    return demoFetch<DemoMatch>(`/matches/${matchId}`);
}

export async function demoDequeue(queueEntryId: string) {
    try {
        return await demoFetch("/queues/dequeue", {
            method: "POST",
            body: JSON.stringify({ queueEntryId, reason: "demo_reset" }),
        });
    } catch {
        return null;
    }
}
