"use client";

import * as React from "react";
import { ArrowRight, Eye, Filter, History, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailDrawer, DetailField, DetailList } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/utils";
import type { AuditLogItem } from "@/lib/api";

interface AuditLogsTableProps {
    logs: AuditLogItem[];
    projectId: string;
}

function getActionBadgeVariant(
    action: string,
): "default" | "secondary" | "destructive" | "success" | "warning" | "outline" {
    if (action.includes("CREATED") || action.includes("RESOLVED") || action.includes("INVITED")) {
        return "success";
    }
    if (
        action.includes("DELETED") ||
        action.includes("REVOKED") ||
        action.includes("LOCKOUT") ||
        action.includes("REMOVED")
    ) {
        return "destructive";
    }
    if (action.includes("REJECTED") || action.includes("PAST_DUE")) {
        return "warning";
    }
    return "secondary";
}

function formatJson(data: unknown): string {
    if (data === null || data === undefined) return "None";
    try {
        return JSON.stringify(data, null, 2);
    } catch {
        return String(data);
    }
}

export function AuditLogsTable({ logs }: AuditLogsTableProps) {
    const [selectedLog, setSelectedLog] = React.useState<AuditLogItem | null>(null);
    const [actionFilter, setActionFilter] = React.useState<string>("ALL");
    const [resourceFilter, setResourceFilter] = React.useState<string>("ALL");

    const uniqueActions = React.useMemo(() => {
        return Array.from(new Set(logs.map((l) => l.action))).toSorted();
    }, [logs]);

    const uniqueResources = React.useMemo(() => {
        return Array.from(new Set(logs.map((l) => l.targetResourceType))).toSorted();
    }, [logs]);

    const filteredLogs = React.useMemo(() => {
        return logs.filter((log) => {
            if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
            if (resourceFilter !== "ALL" && log.targetResourceType !== resourceFilter) return false;
            return true;
        });
    }, [logs, actionFilter, resourceFilter]);

    return (
        <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Filter className="size-3.5" />
                    <span>Filters:</span>
                </div>

                <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    <option value="ALL">All Actions</option>
                    {uniqueActions.map((action) => (
                        <option key={action} value={action}>
                            {action}
                        </option>
                    ))}
                </select>

                <select
                    value={resourceFilter}
                    onChange={(e) => setResourceFilter(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    <option value="ALL">All Resource Types</option>
                    {uniqueResources.map((res) => (
                        <option key={res} value={res}>
                            {res}
                        </option>
                    ))}
                </select>

                {(actionFilter !== "ALL" || resourceFilter !== "ALL") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-muted-foreground"
                        onClick={() => {
                            setActionFilter("ALL");
                            setResourceFilter("ALL");
                        }}
                    >
                        Reset filters
                    </Button>
                )}
            </div>

            {/* Audit Logs Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium">Control-Plane Audit Trail</CardTitle>
                    <CardDescription>
                        Immutable record of administrative mutations, configuration adjustments, and security actions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredLogs.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={History}
                                title="No audit logs recorded"
                                description="Administrative actions within this project will generate an immutable audit trail here."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[180px]">Timestamp</TableHead>
                                        <TableHead>Actor</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Resource Type</TableHead>
                                        <TableHead>Resource ID</TableHead>
                                        <TableHead className="w-[80px] text-right">Inspect</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLogs.map((log) => (
                                        <TableRow
                                            key={log.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                <span title={new Date(log.createdAt).toISOString()}>
                                                    {formatDateTime(log.createdAt)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                <div className="flex items-center gap-1.5 font-medium">
                                                    <User className="size-3.5 text-muted-foreground" />
                                                    {log.actorUser?.email || log.actorUserId || "System / API"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={getActionBadgeVariant(log.action)}
                                                    className="text-[11px] font-mono"
                                                >
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                {log.targetResourceType}
                                            </TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                                                {log.targetResourceId}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLog(log);
                                                    }}
                                                >
                                                    <Eye className="size-3.5 text-muted-foreground" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2-Column JSON Diff Drawer */}
            <DetailDrawer
                open={selectedLog !== null}
                onClose={() => setSelectedLog(null)}
                title={`Audit Record: ${selectedLog?.action || ""}`}
                size="wide"
            >
                {selectedLog && (
                    <div className="space-y-6">
                        {/* Event Metadata */}
                        <div className="rounded-lg border bg-card p-3">
                            <DetailList>
                                <DetailField label="Action">
                                    <Badge
                                        variant={getActionBadgeVariant(selectedLog.action)}
                                        className="font-mono text-xs"
                                    >
                                        {selectedLog.action}
                                    </Badge>
                                </DetailField>
                                <DetailField label="Target Resource" mono>
                                    {selectedLog.targetResourceType} ({selectedLog.targetResourceId})
                                </DetailField>
                                <DetailField label="Actor">
                                    {selectedLog.actorUser?.email || selectedLog.actorUserId || "System / Automated"}
                                </DetailField>
                                <DetailField label="Actor IP" mono>
                                    {selectedLog.actorIp || "N/A"}
                                </DetailField>
                                <DetailField label="User Agent" mono>
                                    <span className="text-[11px] truncate block max-w-[280px]">
                                        {selectedLog.actorUserAgent || "N/A"}
                                    </span>
                                </DetailField>
                                <DetailField label="Timestamp" mono>
                                    {new Date(selectedLog.createdAt).toLocaleString()}
                                </DetailField>
                            </DetailList>
                        </div>

                        {/* 2-Column JSON Diff View */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                <span>State Mutation Diff</span>
                                <span className="text-[11px] font-normal text-muted-foreground">
                                    Sensitive values auto-redacted
                                </span>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {/* Before */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <span>Previous State (Before)</span>
                                    </div>
                                    <pre className="h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground [scrollbar-width:thin]">
                                        {formatJson(selectedLog.metadataBefore)}
                                    </pre>
                                </div>

                                {/* After */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                        <ArrowRight className="size-3" />
                                        <span>New State (After)</span>
                                    </div>
                                    <pre className="h-64 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground [scrollbar-width:thin]">
                                        {formatJson(selectedLog.metadataAfter)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DetailDrawer>
        </div>
    );
}
