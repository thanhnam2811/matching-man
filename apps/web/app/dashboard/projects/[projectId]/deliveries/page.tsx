import { apiFetch, type Delivery, type Paginated } from "@/lib/api";
import { DeliveriesTable } from "@/components/deliveries-table";

const LIMIT = 20;

export default async function DeliveriesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const result = await apiFetch<Paginated<Delivery>>(
        `/projects/${projectId}/webhook-deliveries?limit=${LIMIT}&offset=${offset}`,
    );

    return <DeliveriesTable projectId={projectId} offset={offset} limit={LIMIT} fallback={result} />;
}
