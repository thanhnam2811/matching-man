"use client";

import * as React from "react";
import useSWR from "swr";
import { Swords } from "lucide-react";
import type { MatchSummary, Paginated } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailDrawer, DetailField, DetailList } from "@/components/ui/detail-drawer";
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

    // `current` survives closing so the sheet's content stays put during the exit animation.
    const [current, setCurrent] = React.useState<MatchSummary | null>(null);
    const [open, setOpen] = React.useState(false);
    const close = React.useCallback(() => setOpen(false), []);

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
                                    <TableRow
                                        key={match.id}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            setCurrent(match);
                                            setOpen(true);
                                        }}
                                    >
                                        <TableCell className="font-mono text-xs">
                                            <span
                                                className="inline-flex items-center gap-1"
                                                onClick={(event) => event.stopPropagation()}
                                            >
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

            <DetailDrawer open={open} onClose={close} title="Match details">
                {current ? (
                    <DetailList>
                        <DetailField label="Match ID" mono>
                            <span className="inline-flex items-center gap-1">
                                {current.id}
                                <CopyButton value={current.id} label="Copy match ID" />
                            </span>
                        </DetailField>
                        <DetailField label="Game mode" mono>
                            {current.gameModeId}
                        </DetailField>
                        <DetailField label="Status">
                            <StatusBadge status={current.status} />
                        </DetailField>
                        <DetailField label="Environment">{current.environment}</DetailField>
                        <DetailField label="Region">{current.region}</DetailField>
                        <DetailField label="Required slots">{current.requiredSlots}</DetailField>
                        <DetailField label="Groups">{current.groupCount}</DetailField>
                        <DetailField label="Rating mode">{current.ratingMode}</DetailField>
                        <DetailField label="Winner">
                            {current.result?.winnerGroupIndex != null
                                ? `group ${current.result.winnerGroupIndex}`
                                : "—"}
                        </DetailField>
                        <DetailField label="Ended">
                            {current.result ? formatDateTime(current.result.endedAt) : "—"}
                        </DetailField>
                        <DetailField label="Created">{formatDateTime(current.createdAt)}</DetailField>
                    </DetailList>
                ) : null}
            </DetailDrawer>
        </div>
    );
}
