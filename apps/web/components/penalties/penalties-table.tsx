"use client";

import * as React from "react";
import useSWR from "swr";
import { Search, ShieldAlert, X } from "lucide-react";
import type { Paginated, PlayerPenaltySummary } from "@/lib/api";
import { LIVE_REFRESH_MS } from "@/lib/swr";
import { CreatePenaltyDialog } from "@/components/penalties/create-penalty-dialog";
import { PardonPenaltyButton } from "@/components/penalties/pardon-penalty-button";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { StatusFilter } from "@/components/status-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailDrawer, DetailField, DetailList } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

const PENALTY_STATUSES = ["active", "expired", "revoked"] as const;

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
}

function formatRelativeExpiry(expiresAt: string, isActive: boolean, revokedAt: string | null): string {
    if (revokedAt) return "Revoked by operator";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (!isActive || diff <= 0) return `Expired ${formatDateTime(expiresAt)}`;
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `Expires in ${mins}m`;
    const hours = Math.ceil(mins / 60);
    return `Expires in ${hours}h`;
}

export function PenaltiesTable({
    projectId,
    offset,
    limit,
    status,
    playerId: initialPlayerId,
    fallback,
}: {
    projectId: string;
    offset: number;
    limit: number;
    status?: string;
    playerId?: string;
    fallback: Paginated<PlayerPenaltySummary>;
}) {
    const [searchQuery, setSearchQuery] = React.useState(initialPlayerId ?? "");
    const statusQuery = status ? `&status=${status}` : "";
    const playerQuery = searchQuery ? `&playerId=${encodeURIComponent(searchQuery.trim())}` : "";

    const { data } = useSWR<Paginated<PlayerPenaltySummary>>(
        `/api/projects/${projectId}/penalties?limit=${limit}&offset=${offset}${statusQuery}${playerQuery}`,
        { fallbackData: fallback, refreshInterval: LIVE_REFRESH_MS },
    );
    const result = data ?? fallback;

    const [current, setCurrent] = React.useState<PlayerPenaltySummary | null>(null);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

    const activeCount = React.useMemo(() => {
        return result.data.filter((p) => p.isActive).length;
    }, [result.data]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight">Player Penalties & Moderation</h1>
                        {activeCount > 0 ? (
                            <Badge variant="destructive" className="gap-1 text-[11px] font-mono">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white"></span>
                                </span>
                                {activeCount} Active
                            </Badge>
                        ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Real-time queue dodge timeouts, ready check AFK lockouts, and operator moderation audits.
                    </p>
                </div>
                <CreatePenaltyDialog projectId={projectId} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <StatusFilter
                    basePath={`/dashboard/projects/${projectId}/penalties`}
                    current={status}
                    options={PENALTY_STATUSES.map((value) => ({
                        value,
                        label: value.charAt(0).toUpperCase() + value.slice(1),
                    }))}
                />

                <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by player ID..."
                        className="h-8 w-56 pl-8 pr-7 text-xs"
                    />
                    {searchQuery ? (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear filter"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>
            </div>

            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <EmptyState
                            icon={ShieldAlert}
                            title={status ? `No ${status} penalties` : "No penalty records found"}
                            description={
                                status || searchQuery
                                    ? "Try adjusting your search criteria or switching the status filter."
                                    : "Active player lockouts and automated dodge penalties will appear here automatically."
                            }
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Player ID</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Violation Tier</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expires / Revoked</TableHead>
                                    <TableHead>Issued At</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((penalty) => (
                                    <TableRow
                                        key={penalty.id}
                                        className="cursor-pointer transition-colors hover:bg-muted/40"
                                        onClick={() => {
                                            setCurrent(penalty);
                                            setDrawerOpen(true);
                                        }}
                                    >
                                        <TableCell>
                                            <span
                                                className="inline-flex items-center gap-1 font-mono text-xs font-medium"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {penalty.playerId}
                                                <CopyButton value={penalty.playerId} label="Copy player ID" />
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                                                {penalty.reason.replace(/_/g, " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {formatDuration(penalty.durationSeconds)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                Tier #{penalty.violationCount}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge
                                                status={
                                                    penalty.revokedAt
                                                        ? "revoked"
                                                        : penalty.isActive
                                                          ? "active"
                                                          : "expired"
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatRelativeExpiry(
                                                penalty.expiresAt,
                                                penalty.isActive,
                                                penalty.revokedAt,
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(penalty.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            {penalty.isActive ? (
                                                <PardonPenaltyButton
                                                    projectId={projectId}
                                                    penaltyId={penalty.id}
                                                    playerId={penalty.playerId}
                                                />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                total={result.total}
                limit={limit}
                offset={offset}
                basePath={`/dashboard/projects/${projectId}/penalties`}
                query={{
                    ...(status ? { status } : {}),
                    ...(searchQuery ? { playerId: searchQuery } : {}),
                }}
            />

            <DetailDrawer open={drawerOpen} onClose={closeDrawer} title="Penalty & Audit Details">
                {current ? (
                    <DetailList>
                        <DetailField label="Penalty ID" mono>
                            <span className="inline-flex items-center gap-1">
                                {current.id}
                                <CopyButton value={current.id} label="Copy penalty ID" />
                            </span>
                        </DetailField>

                        <DetailField label="Player ID" mono>
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                                {current.playerId}
                                <CopyButton value={current.playerId} label="Copy player ID" />
                            </span>
                        </DetailField>

                        <DetailField label="Status">
                            <StatusBadge
                                status={current.revokedAt ? "revoked" : current.isActive ? "active" : "expired"}
                            />
                        </DetailField>

                        <DetailField label="Reason">
                            <Badge variant="outline" className="text-[10px] uppercase">
                                {current.reason.replace(/_/g, " ")}
                            </Badge>
                        </DetailField>

                        <DetailField label="Violation Tier">
                            <span className="font-mono text-xs font-semibold">Tier #{current.violationCount}</span>
                        </DetailField>

                        <DetailField label="Lockout Duration">
                            <span className="font-mono text-xs">
                                {formatDuration(current.durationSeconds)} ({current.durationSeconds}s)
                            </span>
                        </DetailField>

                        <DetailField label="Issued At">{formatDateTime(current.createdAt)}</DetailField>

                        <DetailField label="Expires At">{formatDateTime(current.expiresAt)}</DetailField>

                        {current.revokedAt ? (
                            <>
                                <DetailField label="Pardoned At">
                                    <span className="text-foreground">{formatDateTime(current.revokedAt)}</span>
                                </DetailField>
                                <DetailField label="Pardoned By">
                                    <span className="font-mono text-xs text-foreground">
                                        {current.revokedByUser?.email || current.revokedByUser?.name || "Operator"}
                                    </span>
                                </DetailField>
                                <DetailField label="Operator Notes">
                                    <div className="rounded-md border bg-muted/30 p-2.5 font-mono text-xs text-foreground">
                                        {current.revocationNotes || "No notes recorded."}
                                    </div>
                                </DetailField>
                            </>
                        ) : null}

                        {current.isActive ? (
                            <div className="pt-4 border-t">
                                <PardonPenaltyButton
                                    projectId={projectId}
                                    penaltyId={current.id}
                                    playerId={current.playerId}
                                />
                            </div>
                        ) : null}
                    </DetailList>
                ) : null}
            </DetailDrawer>
        </div>
    );
}
