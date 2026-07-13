"use client";

import useSWR from "swr";
import { TrendingUp } from "lucide-react";
import type { Paginated, RatingHistoryEntry } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDateTime } from "@/lib/utils";

export function RatingsTable({
    projectId,
    offset,
    limit,
    fallback,
}: {
    projectId: string;
    offset: number;
    limit: number;
    fallback: Paginated<RatingHistoryEntry>;
}) {
    const { data } = useSWR<Paginated<RatingHistoryEntry>>(
        `/api/projects/${projectId}/ratings?limit=${limit}&offset=${offset}`,
        { fallbackData: fallback, refreshInterval: LIVE_REFRESH_MS },
    );
    const result = data ?? fallback;

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <EmptyState
                            icon={TrendingUp}
                            title="No rating history yet"
                            description="Enable internal Elo for a game mode to start recording rating changes."
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Player</TableHead>
                                    <TableHead>Game mode</TableHead>
                                    <TableHead className="text-right">Before</TableHead>
                                    <TableHead className="text-right">After</TableHead>
                                    <TableHead className="text-right">Δ</TableHead>
                                    <TableHead>When</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono text-xs">
                                            {entry.ratingProfile.playerId}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {entry.ratingProfile.gameModeId}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{entry.ratingBefore}</TableCell>
                                        <TableCell className="text-right font-mono">{entry.ratingAfter}</TableCell>
                                        <TableCell
                                            className={cn(
                                                "text-right font-mono",
                                                entry.delta > 0 && "text-success",
                                                entry.delta < 0 && "text-destructive",
                                            )}
                                        >
                                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(entry.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/ratings`}
                offset={offset}
                limit={limit}
                total={result.total}
            />
        </div>
    );
}
