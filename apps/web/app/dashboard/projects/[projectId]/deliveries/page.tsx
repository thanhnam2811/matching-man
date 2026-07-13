import { apiFetch, type Delivery, type Paginated } from "@/lib/api";
import { DeliveriesTable } from "@/components/deliveries-table";
import { StatusFilter } from "@/components/status-filter";

const LIMIT = 20;
const DELIVERY_STATUSES = ["pending", "delivered", "failed", "exhausted"] as const;

export default async function DeliveriesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string; status?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam, status: statusParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);
    const status = DELIVERY_STATUSES.find((value) => value === statusParam?.toLowerCase());

    const statusQuery = status ? `&status=${status.toUpperCase()}` : "";
    const result = await apiFetch<Paginated<Delivery>>(
        `/projects/${projectId}/webhook-deliveries?limit=${LIMIT}&offset=${offset}${statusQuery}`,
    );

    return (
        <div className="space-y-4">
            <StatusFilter
                basePath={`/dashboard/projects/${projectId}/deliveries`}
                current={status}
                options={DELIVERY_STATUSES.map((value) => ({ value, label: value }))}
            />
            <DeliveriesTable projectId={projectId} offset={offset} limit={LIMIT} status={status} fallback={result} />
        </div>
    );
}
