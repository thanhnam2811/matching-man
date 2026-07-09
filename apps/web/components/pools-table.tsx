"use client";

import useSWR from "swr";
import type { Pool } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function PoolsTable({ projectId, fallback }: { projectId: string; fallback: Pool[] }) {
    const { data } = useSWR<Pool[]>(`/api/projects/${projectId}/pools`, {
        fallbackData: fallback,
        refreshInterval: LIVE_REFRESH_MS,
    });
    const pools = data ?? fallback;

    if (pools.length === 0) {
        return (
            <Card>
                <CardContent className="py-12 text-center text-sm text-muted-foreground">No active pools.</CardContent>
            </Card>
        );
    }

    return (
        <Card className="p-0">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Game mode</TableHead>
                            <TableHead>Environment</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead className="text-right">Queued</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pools.map((pool) => (
                            <TableRow key={pool.id}>
                                <TableCell className="font-mono text-xs">{pool.gameModeId}</TableCell>
                                <TableCell>{pool.environment}</TableCell>
                                <TableCell>{pool.regionKey}</TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={pool.queuedCount > 0 ? "warning" : "secondary"}>
                                        {pool.queuedCount}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {formatDateTime(pool.createdAt)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
