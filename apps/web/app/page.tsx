import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMatchmaking } from "@/components/landing/hero-matchmaking";
import { SiteHeader } from "@/components/landing/site-header";
import { StatsStrip } from "@/components/landing/stats-strip";
import { ArchitecturePipeline } from "@/components/landing/architecture-pipeline";
import { CodeWalkthrough } from "@/components/landing/code-walkthrough";
import { FeatureBento } from "@/components/landing/feature-bento";
import { EnterpriseTrust } from "@/components/landing/enterprise-trust";
import { PricingSection } from "@/components/landing/pricing-section";
import { BottomCta } from "@/components/landing/bottom-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import { MobileCtaBar } from "@/components/landing/mobile-cta-bar";

export const metadata: Metadata = {
    title: "Matching Hub — Matchmaking Infrastructure as a Service",
    description:
        "Queue teams, match by skill with dynamic window expansion, and deliver results through signed webhooks — without building or maintaining matchmaking servers.",
};

export default function LandingPage() {
    return (
        <main className="flex min-h-screen flex-col bg-background text-foreground">
            {/* 1. Navigation Header */}
            <SiteHeader />

            {/* 2. Hero Section */}
            <section className="relative overflow-hidden border-b">
                <div className="pointer-events-none absolute inset-0 bg-grid [background-size:36px_36px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/10 to-transparent" />

                <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
                    <div className="flex flex-col items-start">
                        {/* Release pill */}
                        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-xs">
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground">
                                v1.4.0
                            </span>
                            <span>BullMQ Event-Driven Worker Released</span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                        </div>

                        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                            Matchmaking infrastructure for modern games
                        </h1>
                        <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
                            Slot topology, dynamic Elo window expansion, two-way ready checks, and HMAC-signed webhook
                            delivery — without building or maintaining matchmaking servers.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link href="/register">
                                <Button size="lg" className="shadow-xs">
                                    Start free
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>
                            <Link href="/demo">
                                <Button size="lg" variant="outline">
                                    <Play className="size-3.5 text-success" />
                                    Try the live demo
                                </Button>
                            </Link>
                        </div>

                        {/* Quick CLI Pill */}
                        <div className="mt-6 flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 font-mono text-xs text-muted-foreground shadow-xs">
                            <Terminal className="size-3.5 text-muted-foreground" />
                            <span>pnpm add @matching-hub/sdk</span>
                            <span className="text-[10px] text-muted-foreground/60">· Zero card required</span>
                        </div>
                    </div>

                    <div className="lg:animate-float">
                        <HeroMatchmaking />
                    </div>
                </div>
            </section>

            {/* 3. Live Stats Strip */}
            <StatsStrip />

            {/* 4. Architecture Pipeline Visualizer */}
            <ArchitecturePipeline />

            {/* 5. Interactive Developer Hub & SDK Walkthrough */}
            <CodeWalkthrough />

            {/* 6. Core Capabilities Bento Grid */}
            <FeatureBento />

            {/* 7. Enterprise Governance & Trust */}
            <EnterpriseTrust />

            {/* 8. Pricing Section & Comparison Matrix */}
            <PricingSection />

            {/* 9. Bottom CTA */}
            <BottomCta />

            {/* 10. Multi-Column Footer */}
            <SiteFooter />

            {/* Spacer so the sticky mobile CTA never covers the footer */}
            <div aria-hidden className="h-16 sm:hidden" />
            <MobileCtaBar />
        </main>
    );
}
