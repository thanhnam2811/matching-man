import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, KeyRound, Layers, Lock, RadioTower, Settings, Swords, TrendingUp, Webhook } from "lucide-react";
import {
    ApiError,
    apiFetch,
    type Delivery,
    type MatchSummary,
    type Paginated,
    type Pool,
    type RatingHistoryEntry,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";

const DAY_MS = 86_400_000;
const SPARKLINE_DAYS = 14;

// Buckets ISO timestamps into per-day counts for the last `days` days (oldest first).
function bucketPerDay(timestamps: string[], days: number): number[] {
    const buckets = Array.from({ length: days }, () => 0);
    const start = Date.now() - (days - 1) * DAY_MS;
    for (const iso of timestamps) {
        const index = Math.floor((new Date(iso).getTime() - start) / DAY_MS);
        if (index >= 0 && index < days) buckets[index] += 1;
    }
    return buckets;
}

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;
    const base = `/dashboard/projects/${projectId}`;

    const since7d = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const since14d = new Date(Date.now() - (SPARKLINE_DAYS - 1) * DAY_MS).toISOString();

    let pools: Pool[];
    let matches7d: Paginated<MatchSummary>;
    let completed7d: Paginated<MatchSummary>;
    let recentMatches: Paginated<MatchSummary>;
    let deliveriesAll: Paginated<Delivery>;
    let deliveriesDelivered: Paginated<Delivery>;
    let ratings: Paginated<RatingHistoryEntry>;

    try {
        [pools, matches7d, completed7d, recentMatches, deliveriesAll, deliveriesDelivered, ratings] = await Promise.all(
            [
                apiFetch<Pool[]>(`/projects/${projectId}/pools`),
                apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since7d}&limit=1`),
                apiFetch<Paginated<MatchSummary>>(
                    `/projects/${projectId}/matches?from=${since7d}&status=COMPLETED&limit=1`,
                ),
                apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since14d}&limit=100`),
                apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?limit=1`),
                apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?status=DELIVERED&limit=1`),
                apiFetch<Paginated<RatingHistoryEntry>>(`/projects/${projectId}/rating-history?limit=1`),
            ],
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Card>
                    <CardContent className="p-0">
                        <EmptyState
                            icon={Lock}
                            title="You don't have access to this project"
                            description="Ask a project or organization admin to grant you access."
                            action={{ label: "Back to dashboard", href: "/dashboard" }}
                        />
                    </CardContent>
                </Card>
            );
        }
        throw error;
    }

    const queuedTotal = pools.reduce((sum, pool) => sum + pool.queuedCount, 0);
    const deliveryRate =
        deliveriesAll.total === 0 ? "—" : `${Math.round((deliveriesDelivered.total / deliveriesAll.total) * 100)}%`;
    const matchSparkline = bucketPerDay(
        recentMatches.data.map((match) => match.createdAt),
        SPARKLINE_DAYS,
    );

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={Layers}
                    label="In queue"
                    value={String(queuedTotal)}
                    hint={`${pools.length} active ${pools.length === 1 ? "pool" : "pools"}`}
                    href={`${base}/pools`}
                />
                <StatCard
                    icon={Swords}
                    label="Matches (7d)"
                    value={String(matches7d.total)}
                    hint={`${completed7d.total} completed`}
                    href={`${base}/matches`}
                    sparkline={matchSparkline}
                />
                <StatCard
                    icon={Webhook}
                    label="Delivery success"
                    value={deliveryRate}
                    hint={`${deliveriesAll.total} deliveries all-time`}
                    href={`${base}/deliveries`}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Rating events"
                    value={String(ratings.total)}
                    hint="internal Elo updates"
                    href={`${base}/ratings`}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle>Match Pools</CardTitle>
                            <CardDescription>Active matchmaking pools</CardDescription>
                        </div>
                        <Link
                            href={`${base}/pools`}
                            prefetch
                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            View all
                            <ArrowRight className="size-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {pools.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No active pools currently running.</p>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {pools.slice(0, 5).map((pool) => (
                                    <div
                                        key={pool.id}
                                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-sm"
                                    >
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                <span className="font-mono text-xs">{pool.gameModeId}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {pool.environment} · {pool.regionKey}
                                            </p>
                                        </div>
                                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-xs font-medium">
                                            {pool.queuedCount} waiting
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="min-w-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle>Recent Matches</CardTitle>
                            <CardDescription>Latest engine pairings</CardDescription>
                        </div>
                        <Link
                            href={`${base}/matches`}
                            prefetch
                            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            View all
                            <ArrowRight className="size-3.5" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        {recentMatches.data.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No matches formed yet.</p>
                        ) : (
                            <div className="divide-y divide-border/60">
                                {recentMatches.data.slice(0, 5).map((match) => (
                                    <div
                                        key={match.id}
                                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 text-sm"
                                    >
                                        <div className="min-w-0 space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-xs font-medium text-foreground">
                                                    {match.id.slice(0, 12)}…
                                                </span>
                                                <CopyButton value={match.id} label="Copy match ID" />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {match.gameModeId} · {formatDateTime(match.createdAt)}
                                            </p>
                                        </div>
                                        <StatusBadge status={match.status} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Link
                    href={`${base}/api-keys`}
                    prefetch
                    className="group relative block rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-border hover:bg-muted/30"
                >
                    <div className="flex items-center justify-between pb-2">
                        <KeyRound className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="font-medium text-sm text-foreground">API Keys & Environments</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Manage project API keys, prefixes, and target environments
                    </p>
                </Link>

                <Link
                    href={`${base}/webhooks`}
                    prefetch
                    className="group relative block rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-border hover:bg-muted/30"
                >
                    <div className="flex items-center justify-between pb-2">
                        <RadioTower className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="font-medium text-sm text-foreground">Webhooks</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Configure event delivery endpoints, subscriptions, and signatures
                    </p>
                </Link>

                <Link
                    href={`${base}/settings`}
                    prefetch
                    className="group relative block rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-border hover:bg-muted/30"
                >
                    <div className="flex items-center justify-between pb-2">
                        <Settings className="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="font-medium text-sm text-foreground">Settings & Members</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Manage project team members, ready check, and dodge penalty ladders
                    </p>
                </Link>
            </div>
        </div>
    );
}
