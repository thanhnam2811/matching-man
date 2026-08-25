import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { type DisputeStatus, listDisputes } from "@/lib/api";
import { DisputeStatusBadge } from "@/components/disputes/dispute-status-badge";
import { Pagination } from "@/components/pagination";
import { StatusFilter } from "@/components/status-filter";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDateTime } from "@/lib/utils";

const LIMIT = 20;
const DISPUTE_STATUSES = ["open", "resolved", "rejected"] as const;

export default async function DisputesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string; status?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam, status: statusParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);
    const status = DISPUTE_STATUSES.find((value) => value === statusParam?.toLowerCase());

    const result = await listDisputes(projectId, {
        limit: LIMIT,
        offset,
        status: status ? (status.toUpperCase() as DisputeStatus) : undefined,
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">Match Disputes</h1>
                <p className="text-xs text-muted-foreground">
                    Review player-submitted disputes, inspect match telemetry and replay evidence, and resolve outcomes.
                </p>
            </div>

            <StatusFilter
                basePath={`/dashboard/projects/${projectId}/disputes`}
                current={status}
                options={DISPUTE_STATUSES.map((value) => ({
                    value,
                    label: value.charAt(0).toUpperCase() + value.slice(1),
                }))}
            />

            <Card className="overflow-hidden p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <EmptyState
                            icon={Scale}
                            title={status ? `No ${status} disputes` : "No disputes yet"}
                            description={
                                status
                                    ? "Try switching to another status or clear the filter."
                                    : "Disputes submitted via the API or webhooks will appear here for review and Elo reconciliation."
                            }
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Dispute ID</TableHead>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Claimant Team</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((dispute) => (
                                    <TableRow key={dispute.id}>
                                        <TableCell className="font-mono text-xs">
                                            <span className="inline-flex items-center gap-1">
                                                <Link
                                                    href={`/dashboard/projects/${projectId}/disputes/${dispute.id}`}
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    {dispute.id}
                                                </Link>
                                                <CopyButton value={dispute.id} label="Copy dispute ID" />
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            <span className="inline-flex items-center gap-1">
                                                <Link
                                                    href={`/dashboard/projects/${projectId}/matches`}
                                                    className="text-muted-foreground hover:text-foreground hover:underline"
                                                >
                                                    {dispute.matchId}
                                                </Link>
                                                <CopyButton value={dispute.matchId} label="Copy match ID" />
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {dispute.claimantTeamId ? (
                                                <span className="inline-flex items-center gap-1">
                                                    {dispute.claimantTeamId}
                                                    <CopyButton value={dispute.claimantTeamId} label="Copy team ID" />
                                                </span>
                                            ) : (
                                                "—"
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[220px] truncate text-xs" title={dispute.reason}>
                                            {dispute.reason}
                                        </TableCell>
                                        <TableCell>
                                            <DisputeStatusBadge status={dispute.status} />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(dispute.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Link
                                                href={`/dashboard/projects/${projectId}/disputes/${dispute.id}`}
                                                className={cn(
                                                    buttonVariants({ variant: "outline", size: "sm" }),
                                                    "inline-flex items-center gap-1",
                                                )}
                                            >
                                                {dispute.status === "OPEN" ? "Resolve" : "View"}
                                                <ArrowRight className="size-3" />
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/disputes`}
                offset={offset}
                limit={LIMIT}
                total={result.total}
                query={status ? { status } : undefined}
            />
        </div>
    );
}
