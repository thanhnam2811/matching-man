import { ApiError, NetworkError, TimeoutError, apiFetch } from "@/lib/api";

// Server-only helper for the dashboard's same-origin read proxies. Runs the
// authenticated server-side `apiFetch` (token from the httpOnly cookie) and maps
// failures onto HTTP statuses the client SWR fetcher can reason about.
export async function proxyGet<T>(path: string): Promise<Response> {
    try {
        const data = await apiFetch<T>(path);
        return Response.json(data);
    } catch (error) {
        if (error instanceof ApiError) {
            return Response.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof NetworkError || error instanceof TimeoutError) {
            return Response.json({ error: error.message }, { status: 502 });
        }
        return Response.json({ error: "Unexpected error" }, { status: 500 });
    }
}

export function readPaging(request: Request, fallbackLimit: number): { limit: number; offset: number } {
    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Number(searchParams.get("limit")) || fallbackLimit);
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    return { limit, offset };
}
