import { apiFetch, type Delivery, type Paginated } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

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

    return (
        <div className="space-y-4">
            <Card className="p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">No webhook deliveries.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Attempts</TableHead>
                                    <TableHead>Response</TableHead>
                                    <TableHead>Last attempt</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((delivery) => (
                                    <TableRow key={delivery.id}>
                                        <TableCell className="font-mono text-xs">{delivery.eventType}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={delivery.status} />
                                        </TableCell>
                                        <TableCell className="text-right">{delivery.attemptCount}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {delivery.lastResponseCode ?? delivery.lastError ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(delivery.lastAttemptAt)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(delivery.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/deliveries`}
                offset={offset}
                limit={LIMIT}
                total={result.total}
            />
        </div>
    );
}
