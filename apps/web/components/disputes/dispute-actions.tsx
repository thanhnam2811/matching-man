"use client";

import * as React from "react";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { type FormState, rejectDisputeAction, resolveDisputeAction } from "@/lib/actions";
import type { MatchDisputeDetail } from "@/lib/api";
import { DisputeStatusBadge } from "@/components/disputes/dispute-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/utils";

const initialState: FormState = {};

export function DisputeActions({ projectId, dispute }: { projectId: string; dispute: MatchDisputeDetail }) {
    const [actionTab, setActionTab] = React.useState<"resolve" | "reject">("resolve");
    const [resolveState, resolveAction, resolvePending] = React.useActionState(resolveDisputeAction, initialState);
    const [rejectState, rejectAction, rejectPending] = React.useActionState(rejectDisputeAction, initialState);

    // Compute unique group indices from slots or fallback to groupCount
    const groupIndices = React.useMemo(() => {
        const fromSlots = dispute.match.slots?.map((s) => s.groupIndex).filter((g): g is number => g != null) ?? [];
        const unique = Array.from(new Set(fromSlots)).toSorted((a, b) => a - b);
        if (unique.length > 0) return unique;
        const count = dispute.match.groupCount || 2;
        return Array.from({ length: count }, (_, i) => i + 1);
    }, [dispute.match.slots, dispute.match.groupCount]);

    if (dispute.status !== "OPEN") {
        return (
            <Card className="border-border/80 bg-card">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold">Resolution Outcome</CardTitle>
                        <DisputeStatusBadge status={dispute.status} />
                    </div>
                    <CardDescription>
                        This dispute was resolved on {dispute.resolvedAt ? formatDateTime(dispute.resolvedAt) : "—"}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <span className="text-xs font-medium text-muted-foreground">Resolved By</span>
                            <p className="mt-0.5 font-medium text-foreground">
                                {dispute.resolvedByUser?.name ||
                                    dispute.resolvedByUser?.email ||
                                    dispute.resolvedByUserId ||
                                    "Operator"}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs font-medium text-muted-foreground">Outcome / Winner</span>
                            <p className="mt-0.5 font-medium text-foreground">
                                {dispute.status === "RESOLVED"
                                    ? dispute.overrideWinnerGroupIndex != null
                                        ? `Group ${dispute.overrideWinnerGroupIndex} (Winner Override)`
                                        : "Draw / Match Voided (No winner)"
                                    : "Dispute Rejected (Original outcome retained)"}
                            </p>
                        </div>
                    </div>
                    <div>
                        <span className="text-xs font-medium text-muted-foreground">Operator Notes</span>
                        <div className="mt-1 rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground">
                            {dispute.resolutionNotes || "No resolution notes recorded."}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <ShieldAlert className="size-4 text-warning" />
                        Operator Resolution Actions
                    </CardTitle>
                    <DisputeStatusBadge status={dispute.status} />
                </div>
                <CardDescription>
                    Review match evidence and resolve the dispute with winner override or reject the claim.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex rounded-lg border bg-muted/40 p-1">
                    <button
                        type="button"
                        onClick={() => setActionTab("resolve")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                            actionTab === "resolve"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <CheckCircle2 className="size-3.5 text-success" />
                        Resolve Dispute
                    </button>
                    <button
                        type="button"
                        onClick={() => setActionTab("reject")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                            actionTab === "reject"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <XCircle className="size-3.5 text-destructive" />
                        Reject Dispute
                    </button>
                </div>

                {actionTab === "resolve" ? (
                    <form action={resolveAction} className="space-y-4">
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="disputeId" value={dispute.id} />

                        <div className="space-y-1.5">
                            <Label htmlFor="overrideWinnerGroupIndex" className="text-xs font-medium">
                                Declared Winner Override
                            </Label>
                            <select
                                id="overrideWinnerGroupIndex"
                                name="overrideWinnerGroupIndex"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                defaultValue=""
                            >
                                <option value="" className="bg-card text-foreground">
                                    Declare Draw / Void Match (No Winner)
                                </option>
                                {groupIndices.map((group) => (
                                    <option key={group} value={group} className="bg-card text-foreground">
                                        Group {group} (Award Victory & Reconcile Elo)
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-muted-foreground">
                                Overriding the winner will update match result and automatically reconcile internal Elo
                                ratings if applicable.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="resolveResolutionNotes" className="text-xs font-medium">
                                Operator Resolution Notes <span className="text-destructive">*</span>
                            </Label>
                            <textarea
                                id="resolveResolutionNotes"
                                name="resolutionNotes"
                                rows={3}
                                required
                                placeholder="Explain the findings and rationale for this resolution..."
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        {resolveState.error ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                                {resolveState.error}
                            </p>
                        ) : null}

                        <Button type="submit" disabled={resolvePending} className="w-full">
                            {resolvePending ? (
                                <>
                                    <Spinner size="sm" className="mr-2" />
                                    Resolving Dispute…
                                </>
                            ) : (
                                "Confirm & Resolve Dispute"
                            )}
                        </Button>
                    </form>
                ) : (
                    <form action={rejectAction} className="space-y-4">
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="disputeId" value={dispute.id} />

                        <div className="space-y-1.5">
                            <Label htmlFor="rejectResolutionNotes" className="text-xs font-medium">
                                Operator Rejection Notes <span className="text-destructive">*</span>
                            </Label>
                            <textarea
                                id="rejectResolutionNotes"
                                name="resolutionNotes"
                                rows={3}
                                required
                                placeholder="Explain why this dispute is being rejected (e.g. insufficient proof, legitimate match play)..."
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        {rejectState.error ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                                {rejectState.error}
                            </p>
                        ) : null}

                        <Button type="submit" variant="destructive" disabled={rejectPending} className="w-full">
                            {rejectPending ? (
                                <>
                                    <Spinner size="sm" className="mr-2" />
                                    Rejecting Dispute…
                                </>
                            ) : (
                                "Reject Dispute & Keep Result"
                            )}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
