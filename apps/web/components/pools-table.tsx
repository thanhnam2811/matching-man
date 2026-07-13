"use client";

import * as React from "react";
import useSWR from "swr";
import { Layers, Search, SearchX } from "lucide-react";
import type { Pool } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export function PoolsTable({ projectId, fallback }: { projectId: string; fallback: Pool[] }) {
    const { data } = useSWR<Pool[]>(`/api/projects/${projectId}/pools`, {
        fallbackData: fallback,
        refreshInterval: LIVE_REFRESH_MS,
    });
    const pools = data ?? fallback;
    const [query, setQuery] = React.useState("");

    if (pools.length === 0) {
        return (
            <Card>
                <CardContent className="p-0">
                    <EmptyState
                        icon={Layers}
                        title="No active pools"
                        description="Pools show up here once teams start queuing for a game mode."
                    />
                </CardContent>
            </Card>
        );
    }

    const normalized = query.trim().toLowerCase();
    const filtered = normalized
        ? pools.filter((pool) =>
              [pool.gameModeId, pool.environment, pool.regionKey].some((field) =>
                  field.toLowerCase().includes(normalized),
              ),
          )
        : pools;

    return (
        <div className="space-y-4">
            <div className="relative max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Filter by mode, environment, region…"
                    aria-label="Filter pools"
                    className="pl-8"
                />
            </div>

            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={SearchX}
                            title="No pools match"
                            description={`Nothing matches “${query.trim()}”.`}
                        />
                    ) : (
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
                                {filtered.map((pool) => (
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
