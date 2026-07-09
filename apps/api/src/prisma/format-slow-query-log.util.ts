export type PrismaQueryEvent = {
    query: string;
    duration: number;
};

// Deliberately omits `event.params` — Prisma serializes bind values into that
// field as a raw JSON string, which can contain secrets (password hashes, API
// key hashes, session tokens) that must not land in log storage.
export function formatSlowQueryLog(event: PrismaQueryEvent, thresholdMs: number): Record<string, unknown> | null {
    if (event.duration < thresholdMs) {
        return null;
    }

    return {
        event: "slow_query",
        durationMs: event.duration,
        query: event.query,
    };
}
