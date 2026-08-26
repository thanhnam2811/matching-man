import { listPenalties } from "@/lib/api";
import { PenaltiesTable } from "@/components/penalties/penalties-table";

const LIMIT = 20;
const PENALTY_STATUSES = ["active", "expired", "revoked"] as const;

export default async function PenaltiesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string; status?: string; playerId?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam, status: statusParam, playerId: playerIdParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);
    const status = PENALTY_STATUSES.find((value) => value === statusParam?.toLowerCase());
    const playerId = playerIdParam?.trim() || undefined;

    const result = await listPenalties(projectId, {
        limit: LIMIT,
        offset,
        status: status ? (status.toUpperCase() as "ACTIVE" | "EXPIRED" | "REVOKED") : undefined,
        playerId,
    });

    return (
        <PenaltiesTable
            projectId={projectId}
            offset={offset}
            limit={LIMIT}
            status={status}
            playerId={playerId}
            fallback={result}
        />
    );
}
