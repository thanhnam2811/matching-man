"use client";

import useSWR from "swr";
import type { Delivery, Paginated } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function DeliveriesTable({
    projectId,
    offset,
    limit,
    fallback,
}: {
    projectId: string;
    offset: number;
    limit: number;
    fallback: Paginated<Delivery>;
}) {
    const { data } = useSWR<Paginated<Delivery>>(
        `/api/projects/${projectId}/deliveries?limit=${limit}&offset=${offset}`,
        { fallbackData: fallback, refreshInterval: LIVE_REFRESH_MS },
    );
    const result = data ?? fallback;

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
                limit={limit}
                total={result.total}
            />
        </div>
    );
}
