import type { Pool } from "@/lib/api";
import { proxyGet } from "@/lib/proxy";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    return proxyGet<Pool[]>(`/projects/${projectId}/pools`);
}
