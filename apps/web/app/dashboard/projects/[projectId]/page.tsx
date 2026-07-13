import { notFound } from "next/navigation";
import { Layers, Swords, TrendingUp, Webhook } from "lucide-react";
import {
    ApiError,
    apiFetch,
    type ApiKey,
    type Delivery,
    type Environment,
    type MatchSummary,
    type Paginated,
    type Pool,
    type RatingHistoryEntry,
    type Webhook as WebhookEndpoint,
} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { EnvironmentsManager } from "@/components/environments-manager";
import { StatCard } from "@/components/stat-card";
import { WebhooksManager } from "@/components/webhooks-manager";

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

    let environments: Environment[];
    let apiKeys: ApiKey[];
    let webhooks: WebhookEndpoint[];
    let pools: Pool[];
    let matches7d: Paginated<MatchSummary>;
    let completed7d: Paginated<MatchSummary>;
    let recentMatches: Paginated<MatchSummary>;
    let deliveriesAll: Paginated<Delivery>;
    let deliveriesDelivered: Paginated<Delivery>;
    let ratings: Paginated<RatingHistoryEntry>;
    try {
        [
            environments,
            apiKeys,
            webhooks,
            pools,
            matches7d,
            completed7d,
            recentMatches,
            deliveriesAll,
            deliveriesDelivered,
            ratings,
        ] = await Promise.all([
            apiFetch<Environment[]>(`/projects/${projectId}/environments`),
            apiFetch<ApiKey[]>(`/projects/${projectId}/api-keys`),
            apiFetch<WebhookEndpoint[]>(`/projects/${projectId}/webhooks`),
            apiFetch<Pool[]>(`/projects/${projectId}/pools`),
            apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since7d}&limit=1`),
            apiFetch<Paginated<MatchSummary>>(
                `/projects/${projectId}/matches?from=${since7d}&status=COMPLETED&limit=1`,
            ),
            apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since14d}&limit=100`),
            apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?limit=1`),
            apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?status=DELIVERED&limit=1`),
            apiFetch<Paginated<RatingHistoryEntry>>(`/projects/${projectId}/rating-history?limit=1`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
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
                    <CardHeader>
                        <CardTitle>Environments</CardTitle>
                        <CardDescription>{environments.length} configured</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <EnvironmentsManager projectId={projectId} environments={environments} />
                    </CardContent>
                </Card>

                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle>API keys</CardTitle>
                        <CardDescription>{apiKeys.length} issued</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ApiKeysManager projectId={projectId} apiKeys={apiKeys} />
                    </CardContent>
                </Card>

                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Webhooks</CardTitle>
                        <CardDescription>{webhooks.length} endpoints</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WebhooksManager projectId={projectId} webhooks={webhooks} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
