// Server-only helpers for the public /demo page. The demo project's identity and
// API key come live from the API's self-healing demo account
// (apps/api/src/demo/demo.service.ts) via GET /demo/config, instead of manual
// DEMO_* env vars — so /demo always targets whatever demo-arena project the
// hourly reset cron currently maintains, and every visitor action is logged
// under that same account.

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/v1";

export type DemoMode = "skill" | "casual";

type DemoConfig = {
    projectId: string;
    apiKey: string;
    environment: string;
    gameModes: Record<DemoMode, string>;
};

// Short TTL: cheap to refetch, but avoids hitting the API on every single
// request from a busy /demo session.
const CONFIG_TTL_MS = 60_000;
let cachedConfig: { value: DemoConfig; fetchedAt: number } | null = null;

async function getDemoConfig(): Promise<DemoConfig | null> {
    if (cachedConfig && Date.now() - cachedConfig.fetchedAt < CONFIG_TTL_MS) {
        return cachedConfig.value;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/demo/config`, {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        const value = (await response.json()) as DemoConfig;
        cachedConfig = { value, fetchedAt: Date.now() };
        return value;
    } catch {
        return null;
    }
}

export async function isDemoEnabled(): Promise<boolean> {
    return (await getDemoConfig()) !== null;
}

// Pings the API's /health endpoint (which lives outside the /v1 prefix) so the
// browser can tell whether a free-tier server is still cold-starting. Kept
// server-side because the API has no CORS and the browser can't reach it directly.
export async function demoHealth(): Promise<boolean> {
    const origin = API_BASE_URL.replace(/\/v1\/?$/, "");
    try {
        const response = await fetch(`${origin}/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        return response.ok;
    } catch {
        return false;
    }
}

async function demoFetch<T>(config: DemoConfig, path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}`, ...init?.headers },
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
    const config = await getDemoConfig();
    if (!config) throw new Error("demo not configured");

    const gameModeId = config.gameModes[mode];
    const playerId = `p_${Math.random().toString(36).slice(2, 8)}`;

    const result = await demoFetch<{ queueEntryId: string; status: string; matchId: string | null }>(
        config,
        "/queues/enqueue",
        {
            method: "POST",
            body: JSON.stringify({
                projectId: config.projectId,
                gameModeId,
                environment: config.environment,
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

export async function demoMatch(matchId: string) {
    const config = await getDemoConfig();
    if (!config) throw new Error("demo not configured");
    return demoFetch<DemoMatch>(config, `/matches/${matchId}`);
}

export type DemoQueueEntry = {
    queueEntryId: string;
    status: string;
    poolKey: string;
    queuedAt: string;
    matchId: string | null;
};

// Matching now runs in the background after enqueue responds, so the client
// polls this to learn when a queue entry has been matched.
export async function demoQueueEntry(queueEntryId: string) {
    const config = await getDemoConfig();
    if (!config) throw new Error("demo not configured");
    return demoFetch<DemoQueueEntry>(config, `/queues/entries/${queueEntryId}`);
}

export async function demoDequeue(queueEntryId: string) {
    const config = await getDemoConfig();
    if (!config) return null;
    try {
        return await demoFetch(config, "/queues/dequeue", {
            method: "POST",
            body: JSON.stringify({ queueEntryId, reason: "demo_reset" }),
        });
    } catch {
        return null;
    }
}
