import type { Paginated, PlayerPenaltySummary } from "@/lib/api";
import { proxyGet, readPaging } from "@/lib/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const { limit, offset } = readPaging(request, 20);
    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get("status");
    const playerId = searchParams.get("playerId");

    const queryParts = [`limit=${limit}`, `offset=${offset}`];
    if (status) queryParts.push(`status=${encodeURIComponent(status.toUpperCase())}`);
    if (playerId) queryParts.push(`playerId=${encodeURIComponent(playerId.trim())}`);

    return proxyGet<Paginated<PlayerPenaltySummary>>(`/projects/${projectId}/penalties?${queryParts.join("&")}`);
}
