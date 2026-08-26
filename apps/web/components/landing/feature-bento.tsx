import * as React from "react";
import { Building2, CreditCard, Scale, ShieldAlert, Sparkles, Trophy, Users, Webhook } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "./reveal";

const FEATURES = [
    {
        icon: Users,
        title: "Team-Based Slot Topology",
        body: "Solo is a team of one, parties are teams of N, and team-vs-team fits natively. Configure 1v1, 5v5, Battle Royale, or 4-way FFA through declarative slot and group indices.",
        span: "lg:col-span-3",
        badge: "Topology",
    },
    {
        icon: Trophy,
        title: "Triple Rating Modes",
        body: "Choose internal Elo rating calculation with automatic post-match adjustments, bring-your-own external MMR from your existing backend, or disable skill ranking per mode.",
        span: "lg:col-span-3",
        badge: "Rating Engine",
    },
    {
        icon: ShieldAlert,
        title: "Ready Check & AFK Guard",
        body: "Two-way handshake acceptance, automated countdown timeouts, escalating lockout ladders, and instant priority queue restoration for non-dodging players.",
        span: "lg:col-span-2",
        badge: "Governance",
    },
    {
        icon: Scale,
        title: "Dispute & Outcome Resolution",
        body: "Audit game outcomes, override winners, revert rating updates, and resolve match disputes with one click directly from the dashboard.",
        span: "lg:col-span-2",
        badge: "Disputes",
    },
    {
        icon: Building2,
        title: "Multi-Tenant RBAC & Keys",
        body: "Organizations, projects, hashed API keys, and environment isolation (production, staging, development) with role-based member permissions.",
        span: "lg:col-span-2",
        badge: "Security",
    },
    {
        icon: Webhook,
        title: "Cryptographic HMAC Webhooks",
        body: "Outbound events signed with SHA-256 secret keys and timestamp replay protection. Includes exponential backoff retries and live payload inspection.",
        span: "lg:col-span-3",
        badge: "Event Dispatch",
    },
    {
        icon: CreditCard,
        title: "Metered Billing & QuotaGuard",
        body: "Transparent match & enqueue consumption meters, Stripe Checkout & Customer Portal integration, and non-blocking fail-open quota safety during peak traffic.",
        span: "lg:col-span-3",
        badge: "Billing",
    },
];

export function FeatureBento() {
    return (
        <section className="mx-auto w-full max-w-6xl px-6 py-20" id="features">
            <Reveal className="mb-12 max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5 text-foreground" />
                    Complete Feature Set
                </span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                    Everything the matchmaking layer needs
                </h2>
                <p className="mt-3 text-muted-foreground text-balance">
                    One unified platform for matchmaking queues, rating algorithms, event callbacks, and live operations
                    — so you can ship the game, not the infrastructure.
                </p>
            </Reveal>

            <div className="grid gap-4 lg:grid-cols-6">
                {FEATURES.map((feature, index) => (
                    <Reveal key={feature.title} className={feature.span} delayMs={index * 50}>
                        <Card className="h-full transition-all duration-150 hover:border-foreground/30 hover:shadow-xs">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                                        <feature.icon className="size-4 text-foreground" />
                                    </div>
                                    <span className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider border rounded px-1.5 py-0.5">
                                        {feature.badge}
                                    </span>
                                </div>
                                <CardTitle className="pt-3 text-base font-semibold">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs leading-relaxed text-muted-foreground">
                                {feature.body}
                            </CardContent>
                        </Card>
                    </Reveal>
                ))}
            </div>
        </section>
    );
}
