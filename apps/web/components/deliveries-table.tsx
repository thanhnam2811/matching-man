"use client";

import useSWR from "swr";
import { Webhook } from "lucide-react";
import type { Delivery, Paginated } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function DeliveriesTable({
    projectId,
    offset,
    limit,
    status,
    fallback,
}: {
    projectId: string;
    offset: number;
    limit: number;
    status?: string;
    fallback: Paginated<Delivery>;
}) {
    const statusQuery = status ? `&status=${status}` : "";
    const { data } = useSWR<Paginated<Delivery>>(
        `/api/projects/${projectId}/deliveries?limit=${limit}&offset=${offset}${statusQuery}`,
        { fallbackData: fallback, refreshInterval: LIVE_REFRESH_MS },
    );
    const result = data ?? fallback;

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <EmptyState
                            icon={Webhook}
                            title={status ? `No ${status} deliveries` : "No webhook deliveries yet"}
                            description={
                                status
                                    ? "Try another status or clear the filter."
                                    : "Every event sent to your endpoints will be logged here with its status."
                            }
                        />
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
                limit={limit}
                total={result.total}
                query={status ? { status } : undefined}
            />
        </div>
    );
}
