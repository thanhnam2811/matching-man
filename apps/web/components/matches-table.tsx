"use client";

import useSWR from "swr";
import { Swords } from "lucide-react";
import type { MatchSummary, Paginated } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function MatchesTable({
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
    fallback: Paginated<MatchSummary>;
}) {
    const statusQuery = status ? `&status=${status}` : "";
    const { data } = useSWR<Paginated<MatchSummary>>(
        `/api/projects/${projectId}/matches?limit=${limit}&offset=${offset}${statusQuery}`,
        { fallbackData: fallback, refreshInterval: LIVE_REFRESH_MS },
    );
    const result = data ?? fallback;

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <EmptyState
                            icon={Swords}
                            title={status ? `No ${status.replace(/_/g, " ")} matches` : "No matches yet"}
                            description={
                                status
                                    ? "Try another status or clear the filter."
                                    : "Matches appear here as the engine pairs queued teams."
                            }
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Game mode</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Environment</TableHead>
                                    <TableHead>Winner</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((match) => (
                                    <TableRow key={match.id}>
                                        <TableCell className="font-mono text-xs">
                                            <span className="inline-flex items-center gap-1">
                                                {match.id}
                                                <CopyButton value={match.id} label="Copy match ID" />
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{match.gameModeId}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={match.status} />
                                        </TableCell>
                                        <TableCell>{match.environment}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {match.result?.winnerGroupIndex != null
                                                ? `group ${match.result.winnerGroupIndex}`
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(match.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/matches`}
                offset={offset}
                limit={limit}
                total={result.total}
                query={status ? { status } : undefined}
            />
        </div>
    );
}
