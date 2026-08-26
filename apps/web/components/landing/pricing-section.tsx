"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ExternalLink, Minus, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/use-session";
import { Reveal } from "./reveal";

const BILLING_FAQS = [
    {
        q: "How does the Stripe billing integration work?",
        a: "Matching Hub integrates directly with Stripe Checkout and Stripe Customer Portal for PCI-compliant subscription management. Invoices, receipts, tax IDs, and payment method updates are managed seamlessly through your organization's dashboard.",
    },
    {
        q: "What happens if our game exceeds its monthly match or enqueue quota?",
        a: "We operate on a fail-open design to protect live multiplayer gameplay. You will receive advisory dashboard warnings and email alerts when reaching 80% and 100% capacity. During peak surges, active matchmaking continues during a grace window while you upgrade, preventing lobby interruptions.",
    },
    {
        q: "Can I switch between monthly and annual billing at any time?",
        a: "Yes. Upgrades take effect immediately with pro-rated charges automatically calculated by Stripe. Downgrades take effect at the conclusion of your current billing period so you retain full access to Pro features until your paid period finishes.",
    },
    {
        q: "What is the past-due grace period and cancellation policy?",
        a: "If a renewal payment fails, your account enters a 7-day soft grace window during which all matchmaking operations proceed without interruption. You can cancel your subscription at any time with zero lock-in via the Stripe Customer Portal.",
    },
];

export function PricingSection() {
    const [billingCycle, setBillingCycle] = React.useState<"monthly" | "annual">("annual");
    const session = useSession();
    const isAuthenticated = session.status === "authenticated";

    return (
        <section className="mx-auto w-full max-w-6xl px-6 py-20" id="pricing">
            {/* Header */}
            <Reveal className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5 text-foreground" />
                    Transparent Developer Pricing
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Scale from prototype to millions of matches
                </h2>
                <p className="mt-3 text-balance text-muted-foreground">
                    Start free without a credit card. Upgrade when your game launches and demands production governance.
                </p>

                {/* Billing Cycle Toggle */}
                <div className="mt-8 flex items-center justify-center">
                    <div className="inline-flex items-center rounded-lg border bg-muted/40 p-1 text-xs">
                        <button
                            type="button"
                            onClick={() => setBillingCycle("monthly")}
                            className={`rounded-md px-3.5 py-1.5 font-medium transition-all ${
                                billingCycle === "monthly"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            type="button"
                            onClick={() => setBillingCycle("annual")}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-medium transition-all ${
                                billingCycle === "annual"
                                    ? "bg-background text-foreground shadow-xs"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <span>Annual</span>
                            <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px] font-semibold text-foreground"
                            >
                                Save 20%
                            </Badge>
                        </button>
                    </div>
                </div>
            </Reveal>

            {/* Pricing Cards Grid */}
            <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
                {/* 1. FREE TIER */}
                <Reveal delayMs={0} className="h-full">
                    <Card className="flex h-full flex-col justify-between border-border bg-card">
                        <CardHeader className="p-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Free</CardTitle>
                                <Badge variant="secondary">Starter</Badge>
                            </div>
                            <CardDescription className="mt-1 text-xs">
                                Essential matchmaking tools for prototypes, game jams, and indie testbeds.
                            </CardDescription>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="font-mono text-4xl font-bold tracking-tight text-foreground">$0</span>
                                <span className="text-xs text-muted-foreground">/ month</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Free forever · No credit card required
                            </p>
                        </CardHeader>

                        <CardContent className="flex flex-1 flex-col justify-between p-6 pt-0">
                            <div className="space-y-3 border-t pt-4">
                                <p className="text-xs font-medium text-foreground">Includes:</p>
                                <ul className="space-y-2.5 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">5,000</strong> matches / mo
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">25,000</strong> enqueues / mo
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            Up to <strong className="font-mono text-foreground">5</strong> active match
                                            pools
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">7-day</strong> audit log
                                            retention
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>Standard webhook delivery</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>Community Discord support</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-8">
                                <Link href={isAuthenticated ? "/dashboard" : "/register"} className="w-full">
                                    <Button variant="outline" className="w-full">
                                        {isAuthenticated ? "Go to Dashboard" : "Start Free"}
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </Reveal>

                {/* 2. PRO TIER (Highlighted Most Popular) */}
                <Reveal delayMs={80} className="h-full">
                    <Card className="relative flex h-full flex-col justify-between border-foreground/40 bg-card shadow-md ring-1 ring-foreground/20">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge
                                variant="default"
                                className="gap-1 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                            >
                                <Zap className="size-3 fill-current" />
                                Most Popular
                            </Badge>
                        </div>

                        <CardHeader className="p-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Pro</CardTitle>
                                <Badge variant="default">Production</Badge>
                            </div>
                            <CardDescription className="mt-1 text-xs">
                                High throughput, match governance, and queue safety for live multiplayer games.
                            </CardDescription>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="font-mono text-4xl font-bold tracking-tight text-foreground">
                                    {billingCycle === "annual" ? "$39" : "$49"}
                                </span>
                                <span className="text-xs text-muted-foreground">/ month</span>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                {billingCycle === "annual" ? "Billed annually ($468/yr)" : "Billed monthly"}
                            </p>
                        </CardHeader>

                        <CardContent className="flex flex-1 flex-col justify-between p-6 pt-0">
                            <div className="space-y-3 border-t pt-4">
                                <p className="text-xs font-medium text-foreground">Everything in Free, plus:</p>
                                <ul className="space-y-2.5 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">100,000</strong> matches / mo
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">500,000</strong> enqueues / mo
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            Up to <strong className="font-mono text-foreground">30</strong> active match
                                            pools
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">90-day</strong> audit log
                                            retention
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong>Dodge penalty escalation</strong> ladders
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong>Two-way ready-check</strong> timeouts
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong>Priority webhook retry</strong> with HMAC
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>Priority email & dashboard support</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-8">
                                <Link href={isAuthenticated ? "/dashboard" : "/register?plan=pro"} className="w-full">
                                    <Button className="w-full shadow-xs">
                                        {isAuthenticated ? "Upgrade in Dashboard" : "Upgrade to Pro"}
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </Reveal>

                {/* 3. ENTERPRISE TIER */}
                <Reveal delayMs={160} className="h-full">
                    <Card className="flex h-full flex-col justify-between border-border bg-card">
                        <CardHeader className="p-6">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl">Enterprise</CardTitle>
                                <Badge variant="outline">Custom</Badge>
                            </div>
                            <CardDescription className="mt-1 text-xs">
                                Dedicated compute cluster, strict SLAs, and custom volume concurrency for studios.
                            </CardDescription>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="font-mono text-4xl font-bold tracking-tight text-foreground">
                                    Custom
                                </span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                                Tailored quotas & enterprise invoicing
                            </p>
                        </CardHeader>

                        <CardContent className="flex flex-1 flex-col justify-between p-6 pt-0">
                            <div className="space-y-3 border-t pt-4">
                                <p className="text-xs font-medium text-foreground">Everything in Pro, plus:</p>
                                <ul className="space-y-2.5 text-xs text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="text-foreground">Custom quotas</strong> (Millions+
                                            matches/mo)
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="text-foreground">Unlimited</strong> match pools &
                                            environments
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong className="font-mono text-foreground">365-day</strong> audit log
                                            compliance retention
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong>Dedicated region clustering</strong> & VPC
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>
                                            <strong>99.99%</strong> uptime SLA guarantee
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="size-4 shrink-0 text-foreground" />
                                        <span>Dedicated Slack channel & named engineer</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-8">
                                <a href="mailto:enterprise@matchingman.dev" className="w-full">
                                    <Button variant="outline" className="w-full">
                                        Contact Sales
                                        <ExternalLink className="size-4" />
                                    </Button>
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </Reveal>
            </div>

            {/* Feature Comparison Matrix */}
            <div className="mt-20">
                <div className="mb-8">
                    <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">Compare all features</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Detailed breakdown of limits, engine capabilities, security controls, and support levels.
                    </p>
                </div>

                <div className="overflow-x-auto rounded-lg border bg-card">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="border-b bg-muted/40 text-foreground">
                                <th className="w-1/3 p-4 text-sm font-semibold">Feature Category</th>
                                <th className="w-1/5 p-4 text-center text-sm font-semibold">Free</th>
                                <th className="w-1/5 bg-muted/20 p-4 text-center text-sm font-semibold">Pro</th>
                                <th className="w-1/5 p-4 text-center text-sm font-semibold">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {/* CATEGORY 1: Quotas */}
                            <tr className="bg-muted/10">
                                <td
                                    colSpan={4}
                                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground"
                                >
                                    Quotas & Volume Limits
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Monthly Matches Formed</td>
                                <td className="p-4 text-center font-mono text-muted-foreground">5,000</td>
                                <td className="bg-muted/20 p-4 text-center font-mono font-medium text-foreground">
                                    100,000
                                </td>
                                <td className="p-4 text-center font-mono text-muted-foreground">Custom (Millions+)</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Monthly Enqueue Operations</td>
                                <td className="p-4 text-center font-mono text-muted-foreground">25,000</td>
                                <td className="bg-muted/20 p-4 text-center font-mono font-medium text-foreground">
                                    500,000
                                </td>
                                <td className="p-4 text-center font-mono text-muted-foreground">Unlimited</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Active Matchmaking Pools</td>
                                <td className="p-4 text-center font-mono text-muted-foreground">5</td>
                                <td className="bg-muted/20 p-4 text-center font-mono font-medium text-foreground">
                                    30
                                </td>
                                <td className="p-4 text-center font-mono text-muted-foreground">Unlimited</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Audit Log Retention</td>
                                <td className="p-4 text-center font-mono text-muted-foreground">7 days</td>
                                <td className="bg-muted/20 p-4 text-center font-mono font-medium text-foreground">
                                    90 days
                                </td>
                                <td className="p-4 text-center font-mono text-muted-foreground">365 days</td>
                            </tr>

                            {/* CATEGORY 2: Matchmaking Rules */}
                            <tr className="bg-muted/10">
                                <td
                                    colSpan={4}
                                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground"
                                >
                                    Matchmaking Engine & Rules
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Slot-Based Matching (1v1, 5v5, FFA)</td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Elo & External Skill Ratings</td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Dynamic Expanding Skill Windows</td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Two-Way Ready-Check Handshake</td>
                                <td className="p-4 text-center">
                                    <Minus className="mx-auto size-4 text-muted-foreground/40" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Escalating Dodge Penalty Ladders</td>
                                <td className="p-4 text-center">
                                    <Minus className="mx-auto size-4 text-muted-foreground/40" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Match Dispute Resolution</td>
                                <td className="p-4 text-center">
                                    <Minus className="mx-auto size-4 text-muted-foreground/40" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>

                            {/* CATEGORY 3: Security & Governance */}
                            <tr className="bg-muted/10">
                                <td
                                    colSpan={4}
                                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground"
                                >
                                    Security, Audit & Support
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">HMAC-Signed Webhooks</td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="bg-muted/20 p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                                <td className="p-4 text-center">
                                    <Check className="mx-auto size-4 text-foreground" />
                                </td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Support Channel</td>
                                <td className="p-4 text-center text-muted-foreground">Community Discord</td>
                                <td className="bg-muted/20 p-4 text-center font-medium text-foreground">
                                    Priority Email
                                </td>
                                <td className="p-4 text-center font-medium text-foreground">Dedicated Slack</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium text-foreground">Uptime SLA</td>
                                <td className="p-4 text-center text-muted-foreground">Best effort</td>
                                <td className="bg-muted/20 p-4 text-center text-muted-foreground">99.9%</td>
                                <td className="p-4 text-center font-medium text-foreground">99.99% Guarantee</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pricing FAQ */}
            <div className="mt-20">
                <div className="mb-8 text-center">
                    <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Billing & Plans FAQ</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Everything you need to know about quotas, payments, and plan governance.
                    </p>
                </div>

                <div className="divide-y overflow-hidden rounded-lg border bg-card">
                    {BILLING_FAQS.map((item) => (
                        <details key={item.q} className="group px-5 py-4">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                                {item.q}
                                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                            </summary>
                            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
