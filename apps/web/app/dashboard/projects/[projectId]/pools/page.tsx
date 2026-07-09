import { apiFetch, type Pool } from "@/lib/api";
import { PoolsTable } from "@/components/pools-table";

export default async function PoolsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const pools = await apiFetch<Pool[]>(`/projects/${projectId}/pools`);

    return <PoolsTable projectId={projectId} fallback={pools} />;
}
