import { ApiError, NetworkError } from "@/lib/api-errors";

// Client-side SWR fetcher for same-origin proxy route handlers (`/api/...`).
// The handlers attach the session token server-side, so the browser never sees
// it — this only ever hits our own Next.js routes, not the API directly.
export async function jsonFetcher<T>(url: string): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url);
    } catch {
        throw new NetworkError();
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ApiError(response.status, body || response.statusText);
    }

    return response.json() as Promise<T>;
}

// Operational list views (pools/matches/deliveries/ratings) change over time, so
// they revalidate on this cadence in addition to focus/reconnect revalidation.
export const LIVE_REFRESH_MS = 10_000;
