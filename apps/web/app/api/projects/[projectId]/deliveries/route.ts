import type { Delivery, Paginated } from "@/lib/api";
import { proxyGet, readPaging } from "@/lib/proxy";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const { limit, offset } = readPaging(request, 20);
    const status = new URL(request.url).searchParams.get("status");
    const statusQuery = status ? `&status=${encodeURIComponent(status.toUpperCase())}` : "";
    return proxyGet<Paginated<Delivery>>(
        `/projects/${projectId}/webhook-deliveries?limit=${limit}&offset=${offset}${statusQuery}`,
    );
}
