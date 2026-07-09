import type { Paginated, RatingHistoryEntry } from "@/lib/api";
import { proxyGet, readPaging } from "@/lib/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const { limit, offset } = readPaging(request, 20);
    return proxyGet<Paginated<RatingHistoryEntry>>(
        `/projects/${projectId}/rating-history?limit=${limit}&offset=${offset}`,
    );
}
