import type { MatchSummary, Paginated } from "@/lib/api";
import { proxyGet, readPaging } from "@/lib/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const { limit, offset } = readPaging(request, 20);
    return proxyGet<Paginated<MatchSummary>>(`/projects/${projectId}/matches?limit=${limit}&offset=${offset}`);
}
