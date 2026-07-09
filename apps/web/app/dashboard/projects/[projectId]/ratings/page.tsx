import { apiFetch, type Paginated, type RatingHistoryEntry } from "@/lib/api";
import { RatingsTable } from "@/components/ratings-table";

const LIMIT = 20;

export default async function RatingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const result = await apiFetch<Paginated<RatingHistoryEntry>>(
        `/projects/${projectId}/rating-history?limit=${LIMIT}&offset=${offset}`,
    );

    return <RatingsTable projectId={projectId} offset={offset} limit={LIMIT} fallback={result} />;
}
