import { apiFetch, type MatchSummary, type Paginated } from "@/lib/api";
import { MatchesTable } from "@/components/matches-table";

const LIMIT = 20;

export default async function MatchesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const result = await apiFetch<Paginated<MatchSummary>>(
        `/projects/${projectId}/matches?limit=${LIMIT}&offset=${offset}`,
    );

    return <MatchesTable projectId={projectId} offset={offset} limit={LIMIT} fallback={result} />;
}
