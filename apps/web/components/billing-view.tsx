"use client";

import * as React from "react";
import { Check, CreditCard, ExternalLink, ShieldAlert, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import type { OrganizationSubscriptionSummary } from "@/lib/api";
import { createCheckoutSessionAction, createCustomerPortalAction } from "@/lib/actions";

interface BillingViewProps {
    organizationId: string;
    organizationName: string;
    subscription: OrganizationSubscriptionSummary;
}

function UsageProgressBar({
    label,
    used,
    limit,
    unit = "",
}: {
    label: string;
    used: number;
    limit: number;
    unit?: string;
}) {
    const isUnlimited = limit === -1;
    const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
    const isWarning = !isUnlimited && percentage >= 80 && percentage < 100;
    const isExceeded = !isUnlimited && percentage >= 100;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{label}</span>
                <span className="font-mono text-muted-foreground">
                    {used.toLocaleString()} {unit} / {isUnlimited ? "Unlimited" : `${limit.toLocaleString()} ${unit}`}{" "}
                    {!isUnlimited && `(${percentage}%)`}
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                    className={`h-full transition-all ${
                        isExceeded ? "bg-destructive" : isWarning ? "bg-warning" : "bg-foreground"
                    }`}
                    style={{ width: isUnlimited ? "2%" : `${Math.max(2, percentage)}%` }}
                />
            </div>
            {isExceeded ? (
                <p className="text-[11px] font-medium text-destructive">
                    Quota exceeded. Further operations may be throttled or blocked.
                </p>
            ) : isWarning ? (
                <p className="text-[11px] font-medium text-warning">Approaching plan quota limit.</p>
            ) : null}
        </div>
    );
}

export function BillingView({ organizationId, organizationName, subscription }: BillingViewProps) {
    const [pendingAction, setPendingAction] = React.useState<"checkout" | "portal" | null>(null);
    const [actionError, setActionError] = React.useState<string | null>(null);

    const isPastDue = subscription.subscription?.status === "PAST_DUE";
    const isPro = subscription.planTier === "PRO";
    const isEnterprise = subscription.planTier === "ENTERPRISE";

    async function handleCheckout() {
        setActionError(null);
        setPendingAction("checkout");
        try {
            const res = await createCheckoutSessionAction(organizationId, "PRO");
            if (res?.url) {
                window.location.href = res.url;
                return;
            }
            if (res?.error) setActionError(res.error);
        } catch (err: any) {
            setActionError(err?.message || "Failed to initiate Checkout.");
        } finally {
            setPendingAction(null);
        }
    }

    async function handlePortal() {
        setActionError(null);
        setPendingAction("portal");
        try {
            const res = await createCustomerPortalAction(organizationId);
            if (res?.url) {
                window.location.href = res.url;
                return;
            }
            if (res?.error) setActionError(res.error);
        } catch (err: any) {
            setActionError(err?.message || "Failed to open Customer Portal.");
        } finally {
            setPendingAction(null);
        }
    }

    return (
        <div className="space-y-6">
            {isPastDue && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0" />
                    <div className="space-y-1">
                        <p className="font-semibold">Payment Action Required</p>
                        <p className="text-destructive/90">
                            The latest subscription renewal invoice failed. Your active matchmaking remains available
                            under the 7-day grace window. Please update your payment method to avoid quota restrictions.
                        </p>
                    </div>
                </div>
            )}

            {actionError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {actionError}
                </div>
            )}

            {/* Current Usage & Tier Overview */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-medium">Subscription & Monthly Quotas</CardTitle>
                        <CardDescription>
                            Current resource usage for {organizationName} across all environments and projects.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={isPastDue ? "destructive" : isPro ? "default" : "secondary"}>
                            {subscription.planTier} PLAN
                        </Badge>
                        {subscription.subscription?.status && (
                            <Badge variant="outline" className="font-mono text-xs">
                                {subscription.subscription.status}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <UsageProgressBar
                            label="Match Generations"
                            used={subscription.usage.matchesCreated}
                            limit={subscription.limits.maxMonthlyMatches}
                            unit="matches"
                        />
                        <UsageProgressBar
                            label="Queue Enqueues"
                            used={subscription.usage.enqueueRequests}
                            limit={subscription.limits.maxMonthlyEnqueues}
                            unit="requests"
                        />
                        <UsageProgressBar
                            label="Webhook Deliveries"
                            used={subscription.usage.webhookDeliveries}
                            limit={subscription.limits.maxWebhooks * 1000}
                            unit="events"
                        />
                        <UsageProgressBar
                            label="Peak Active Pools"
                            used={subscription.usage.peakActivePools}
                            limit={subscription.limits.maxActivePools}
                            unit="pools"
                        />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <div className="text-xs text-muted-foreground">
                            Audit log retention:{" "}
                            <span className="font-medium text-foreground">
                                {subscription.limits.auditLogRetentionDays} days
                            </span>
                            {subscription.subscription?.currentPeriodEnd && (
                                <>
                                    {" "}
                                    &bull; Renews on:{" "}
                                    <span className="font-mono text-foreground">
                                        {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString()}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {subscription.subscription?.status ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePortal}
                                    disabled={pendingAction !== null}
                                >
                                    {pendingAction === "portal" ? (
                                        <Spinner size="sm" className="mr-2" />
                                    ) : (
                                        <CreditCard className="mr-2 size-4" />
                                    )}
                                    Manage Billing & Invoices
                                </Button>
                            ) : null}

                            {!isPro && !isEnterprise && (
                                <Button size="sm" onClick={handleCheckout} disabled={pendingAction !== null}>
                                    {pendingAction === "checkout" ? (
                                        <Spinner size="sm" className="mr-2" />
                                    ) : (
                                        <Sparkles className="mr-2 size-4" />
                                    )}
                                    Upgrade to Pro
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Plans Comparison Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                {/* Free Tier */}
                <Card className={subscription.planTier === "FREE" ? "border-foreground/30 shadow-sm" : ""}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Starter / Free</CardTitle>
                            {subscription.planTier === "FREE" && <Badge variant="secondary">Current</Badge>}
                        </div>
                        <div className="pt-2">
                            <span className="text-2xl font-bold">$0</span>
                            <span className="text-xs text-muted-foreground"> / month</span>
                        </div>
                        <CardDescription className="text-xs">
                            Essential matchmaking tools for prototypes and indie game testing.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                5,000 matches / month
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                25,000 enqueue operations
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                Up to 5 active match pools
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />2 Webhook endpoints
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                7-day audit log retention
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Pro Tier */}
                <Card
                    className={`relative overflow-hidden ${isPro ? "border-foreground/40 shadow-md" : "border-border"}`}
                >
                    <div className="absolute right-0 top-0 rounded-bl bg-foreground px-2 py-0.5 text-[10px] font-semibold text-background">
                        RECOMMENDED
                    </div>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-1.5">
                                <Zap className="size-4" /> Pro
                            </CardTitle>
                            {isPro && <Badge variant="default">Current</Badge>}
                        </div>
                        <div className="pt-2">
                            <span className="text-2xl font-bold">$49</span>
                            <span className="text-xs text-muted-foreground"> / month</span>
                        </div>
                        <CardDescription className="text-xs">
                            High throughput and governance for live production multiplayer titles.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs text-muted-foreground">
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                100,000 matches / month
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                500,000 enqueue operations
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                Up to 30 active match pools
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                10 Webhook endpoints
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                90-day enterprise audit log retention
                            </li>
                        </ul>

                        {!isPro && (
                            <Button
                                className="w-full"
                                size="sm"
                                onClick={handleCheckout}
                                disabled={pendingAction !== null}
                            >
                                {pendingAction === "checkout" ? <Spinner size="sm" className="mr-2" /> : null}
                                Upgrade to Pro
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Enterprise Tier */}
                <Card className={isEnterprise ? "border-foreground/40" : ""}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Enterprise</CardTitle>
                            {isEnterprise && <Badge variant="default">Current</Badge>}
                        </div>
                        <div className="pt-2">
                            <span className="text-2xl font-bold">Custom</span>
                        </div>
                        <CardDescription className="text-xs">
                            Dedicated compute cluster, custom SLAs, and high volume concurrency.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs text-muted-foreground">
                        <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                Unlimited matches & enqueues
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                Unlimited match pools
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                365-day compliance audit retention
                            </li>
                            <li className="flex items-center gap-2 text-foreground">
                                <Check className="size-3.5 text-foreground shrink-0" />
                                Dedicated support & custom SLA
                            </li>
                        </ul>

                        <Button variant="outline" className="w-full" size="sm" asChild>
                            <a
                                href="mailto:enterprise@matchingman.dev"
                                className="inline-flex items-center justify-center gap-1.5"
                            >
                                Contact Sales <ExternalLink className="size-3" />
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
