import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Code, FileText, Swords, Users } from "lucide-react";
import { ApiError, getDispute } from "@/lib/api";
import { DisputeActions } from "@/components/disputes/dispute-actions";
import { DisputeStatusBadge } from "@/components/disputes/dispute-status-badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { DetailField, DetailList } from "@/components/ui/detail-drawer";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDateTime } from "@/lib/utils";

function parseTeamMembers(snapshot: unknown): Array<{ playerId: string; rating?: number | null }> {
    if (!Array.isArray(snapshot)) return [];
    return snapshot.flatMap((member) => {
        if (typeof member !== "object" || member === null) return [];
        const playerId = "playerId" in member && typeof member.playerId === "string" ? member.playerId : undefined;
        const rating = "rating" in member && typeof member.rating === "number" ? member.rating : null;
        if (!playerId) return [];
        return [{ playerId, rating }];
    });
}

export default async function DisputeDetailPage({
    params,
}: {
    params: Promise<{ projectId: string; disputeId: string }>;
}) {
    const { projectId, disputeId } = await params;

    let dispute;
    try {
        dispute = await getDispute(projectId, disputeId);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        throw error;
    }

    const breadcrumbs = [
        { label: "Projects", href: "/dashboard" },
        { label: "Project", href: `/dashboard/projects/${projectId}` },
        { label: "Disputes", href: `/dashboard/projects/${projectId}/disputes` },
        { label: dispute.id },
    ];

    const slots = dispute.match.slots ?? [];
    // Group slots by groupIndex
    const groupsMap = new Map<number, typeof slots>();
    for (const slot of slots) {
        const list = groupsMap.get(slot.groupIndex) ?? [];
        list.push(slot);
        groupsMap.set(slot.groupIndex, list);
    }
    const sortedGroupIndices = Array.from(groupsMap.keys()).toSorted((a, b) => a - b);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3">
                <Breadcrumbs items={breadcrumbs} />

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/dashboard/projects/${projectId}/disputes`}
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
                        >
                            <ArrowLeft className="size-4 mr-1" />
                            Back to disputes
                        </Link>
                        <div className="flex items-center gap-2 font-mono text-lg font-semibold tracking-tight">
                            <span>Dispute {dispute.id}</span>
                            <CopyButton value={dispute.id} label="Copy dispute ID" />
                        </div>
                        <DisputeStatusBadge status={dispute.status} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    {/* Dispute Claim Overview */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <FileText className="size-4 text-muted-foreground" />
                                Dispute Claim Overview
                            </CardTitle>
                            <CardDescription>Submitted by player or client integration.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DetailList>
                                <DetailField label="Dispute ID" mono>
                                    <span className="inline-flex items-center gap-1">
                                        {dispute.id}
                                        <CopyButton value={dispute.id} label="Copy dispute ID" />
                                    </span>
                                </DetailField>
                                <DetailField label="Status">
                                    <DisputeStatusBadge status={dispute.status} />
                                </DetailField>
                                <DetailField label="Claimant Team ID" mono>
                                    {dispute.claimantTeamId ? (
                                        <span className="inline-flex items-center gap-1">
                                            {dispute.claimantTeamId}
                                            <CopyButton value={dispute.claimantTeamId} label="Copy claimant team ID" />
                                        </span>
                                    ) : (
                                        "None (Global Match Claim)"
                                    )}
                                </DetailField>
                                <DetailField label="Created">{formatDateTime(dispute.createdAt)}</DetailField>
                                <DetailField label="Last Updated">{formatDateTime(dispute.updatedAt)}</DetailField>
                            </DetailList>

                            <div className="mt-4 border-t pt-3">
                                <span className="text-xs font-medium text-muted-foreground">Reason / Description</span>
                                <p className="mt-1 rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                                    {dispute.reason}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contested Match Details */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                <Swords className="size-4 text-muted-foreground" />
                                Contested Match Details
                            </CardTitle>
                            <CardDescription>
                                Match configuration, slots, and original reported outcome.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <DetailList>
                                <DetailField label="Match ID" mono>
                                    <span className="inline-flex items-center gap-1">
                                        {dispute.match.id}
                                        <CopyButton value={dispute.match.id} label="Copy match ID" />
                                    </span>
                                </DetailField>
                                <DetailField label="Game Mode" mono>
                                    {dispute.match.gameMode?.name || dispute.match.gameModeId}
                                </DetailField>
                                <DetailField label="Match Status">
                                    <StatusBadge status={dispute.match.status} />
                                </DetailField>
                                <DetailField label="Environment">{dispute.match.environment}</DetailField>
                                <DetailField label="Region">{dispute.match.regionKey}</DetailField>
                                <DetailField label="Rating Mode">{dispute.match.ratingMode}</DetailField>
                                <DetailField label="Original Result">
                                    {dispute.match.result?.winnerGroupIndex != null
                                        ? `Group ${dispute.match.result.winnerGroupIndex} Won`
                                        : dispute.match.result
                                          ? "Draw / Void"
                                          : "Unrecorded"}
                                </DetailField>
                            </DetailList>

                            <div className="space-y-3 border-t pt-3">
                                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    <Users className="size-3.5" />
                                    Match Slots & Teams
                                </div>

                                {sortedGroupIndices.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No slot data available.</p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {sortedGroupIndices.map((groupIndex) => {
                                            const groupSlots = groupsMap.get(groupIndex) ?? [];
                                            const isOriginalWinner =
                                                dispute.match.result?.winnerGroupIndex === groupIndex;

                                            return (
                                                <div
                                                    key={groupIndex}
                                                    className="rounded-md border bg-muted/20 p-3 space-y-2 text-xs"
                                                >
                                                    <div className="flex items-center justify-between font-semibold">
                                                        <span>Group {groupIndex}</span>
                                                        {isOriginalWinner ? (
                                                            <span className="rounded bg-success/20 px-1.5 py-0.5 text-[10px] font-medium text-success">
                                                                Original Winner
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        {groupSlots.map((slot) => {
                                                            const members = parseTeamMembers(slot.teamSnapshot);
                                                            return (
                                                                <div
                                                                    key={slot.id}
                                                                    className="rounded border border-border/50 bg-background/50 p-2 font-mono text-[11px]"
                                                                >
                                                                    <div className="text-muted-foreground text-[10px]">
                                                                        Ticket: {slot.ticketId}
                                                                    </div>
                                                                    {members.length > 0 ? (
                                                                        <div className="mt-1 space-y-0.5">
                                                                            {members.map((m) => (
                                                                                <div
                                                                                    key={m.playerId}
                                                                                    className="flex items-center justify-between"
                                                                                >
                                                                                    <span className="truncate">
                                                                                        {m.playerId}
                                                                                    </span>
                                                                                    {m.rating != null ? (
                                                                                        <span className="text-muted-foreground text-[10px]">
                                                                                            Elo: {m.rating}
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-muted-foreground">
                                                                            No team snapshot payload
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Evidence Viewer */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                                    <Code className="size-4 text-muted-foreground" />
                                    Dispute Evidence
                                </CardTitle>
                                {dispute.evidence ? (
                                    <CopyButton
                                        value={JSON.stringify(dispute.evidence, null, 2)}
                                        label="Copy evidence JSON"
                                    />
                                ) : null}
                            </div>
                            <CardDescription>
                                Arbitrary telemetry, logs, or replay evidence payload submitted with the dispute.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dispute.evidence ? (
                                <pre className="max-h-96 overflow-x-auto rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground [scrollbar-width:thin]">
                                    <code>{JSON.stringify(dispute.evidence, null, 2)}</code>
                                </pre>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No evidence payload was attached to this dispute.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Resolution & Actions */}
                <div className="space-y-6">
                    <DisputeActions projectId={projectId} dispute={dispute} />
                </div>
            </div>
        </div>
    );
}
