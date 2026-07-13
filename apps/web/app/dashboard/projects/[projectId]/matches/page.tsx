import { apiFetch, type MatchSummary, type Paginated } from "@/lib/api";
import { MatchesTable } from "@/components/matches-table";
import { StatusFilter } from "@/components/status-filter";

const LIMIT = 20;
const MATCH_STATUSES = ["created", "in_progress", "completed", "failed", "expired", "disputed"] as const;

export default async function MatchesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string; status?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam, status: statusParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);
    const status = MATCH_STATUSES.find((value) => value === statusParam?.toLowerCase());

    const statusQuery = status ? `&status=${status.toUpperCase()}` : "";
    const result = await apiFetch<Paginated<MatchSummary>>(
        `/projects/${projectId}/matches?limit=${LIMIT}&offset=${offset}${statusQuery}`,
    );

    return (
        <div className="space-y-4">
            <StatusFilter
                basePath={`/dashboard/projects/${projectId}/matches`}
                current={status}
                options={MATCH_STATUSES.map((value) => ({ value, label: value.replace(/_/g, " ") }))}
            />
            <MatchesTable projectId={projectId} offset={offset} limit={LIMIT} status={status} fallback={result} />
        </div>
    );
}
