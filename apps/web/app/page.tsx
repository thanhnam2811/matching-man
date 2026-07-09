import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Boxes, Building2, Gauge, Sparkles, Trophy, Users, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/landing/reveal";
import { HeroMatchmaking } from "@/components/landing/hero-matchmaking";
import { CodeWindow } from "@/components/landing/code-window";
import { Faq } from "@/components/landing/faq";
import { SiteHeader } from "@/components/landing/site-header";

export const metadata: Metadata = {
    title: "Matching Hub — Matchmaking infrastructure for your game",
    description:
        "Queue teams, match by skill, and deliver results through signed webhooks — without building the matchmaking engine yourself.",
};

const FEATURES = [
    {
        icon: Users,
        title: "Team-based by default",
        body: "Solo is a team of one, parties are teams of N, and team-vs-team fits without rebuilding the model.",
        span: "lg:col-span-3",
    },
    {
        icon: Trophy,
        title: "Skill or neutral",
        body: "Internal Elo, bring-your-own external ratings, or disabled — chosen per game mode.",
        span: "lg:col-span-3",
    },
    {
        icon: Gauge,
        title: "Expanding rating window",
        body: "Tight matches first; the allowed skill gap widens over time so nobody waits forever.",
        span: "lg:col-span-2",
    },
    {
        icon: Boxes,
        title: "Slot-based matches",
        body: "1v1, 5v5, or free-for-all expressed as slots and groups — versus and FFA from one engine.",
        span: "lg:col-span-2",
    },
    {
        icon: Building2,
        title: "Multi-tenant dashboard",
        body: "Organizations, projects, API keys, environments, and role-based access out of the box.",
        span: "lg:col-span-2",
    },
    {
        icon: Webhook,
        title: "Signed, retried webhooks",
        body: "HMAC-signed delivery with exponential backoff and a full delivery log you can inspect — so a match result never silently disappears.",
        span: "lg:col-span-6",
    },
];

const STATS = [
    { value: "Versus + FFA", label: "match structures" },
    { value: "Team-based", label: "solo to N-player parties" },
    { value: "Elo or external", label: "rating per mode" },
    { value: "Signed webhooks", label: "with retries" },
];

const STEPS = [
    { n: "1", title: "Configure a game mode", body: "Set structure, team sizes, and rating behaviour per project." },
    { n: "2", title: "Enqueue teams", body: "Your game server posts queue entries with one API call." },
    { n: "3", title: "A match forms", body: "The engine pairs eligible teams and assembles strict slots." },
    { n: "4", title: "Get the callback", body: "A signed match.created webhook hits your server in real time." },
];

const ENQUEUE_SNIPPET = `curl -X POST https://api.yourhub.dev/v1/queues/enqueue \\
  -H "Authorization: Bearer <project_api_key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "proj_123",
    "gameModeId": "mode_ranked_1v1",
    "environment": "production",
    "team": { "members": [{ "playerId": "p1", "rating": 1500 }] }
  }'`;

const WEBHOOK_SNIPPET = `POST https://game.example.com/hook
X-Webhook-Signature: sha256=…

{
  "event": "match.created",
  "matchId": "match_abc",
  "gameModeId": "mode_ranked_1v1",
  "environment": "production"
}`;

export default function LandingPage() {
    return (
        <main className="flex min-h-screen flex-col">
            <SiteHeader />

            {/* Hero */}
            <section className="relative overflow-hidden border-b">
                <div className="pointer-events-none absolute inset-0 bg-grid [background-size:36px_36px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-primary/10 to-transparent" />
                <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
                    <div className="flex flex-col items-start">
                        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                            <Sparkles className="size-3" />
                            Matchmaking as a service
                        </span>
                        <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                            Matchmaking infrastructure for your game
                        </h1>
                        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground">
                            Queue teams, match by skill, and deliver results through signed webhooks — without building
                            the engine yourself.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-3">
                            <Link href="/register">
                                <Button size="lg">
                                    Start free
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>
                            <Link href="/demo">
                                <Button size="lg" variant="outline">
                                    Try the live demo
                                </Button>
                            </Link>
                        </div>
                        <p className="mt-4 text-xs text-muted-foreground">
                            No card required · slot-based engine · internal Elo or external ratings
                        </p>
                    </div>
                    <div className="lg:animate-float">
                        <HeroMatchmaking />
                    </div>
                </div>
            </section>

            {/* Stats strip */}
            <section className="border-b bg-muted/20">
                <div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-y px-6 sm:grid-cols-4 sm:divide-y-0">
                    {STATS.map((stat) => (
                        <div key={stat.value} className="px-2 py-6 text-center">
                            <div className="text-lg font-semibold tracking-tight">{stat.value}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features (bento) */}
            <section className="mx-auto w-full max-w-6xl px-6 py-20">
                <Reveal className="mb-10 max-w-2xl">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Everything the matchmaking layer needs
                    </h2>
                    <p className="mt-3 text-muted-foreground">
                        One engine for pairing, ratings, and delivery — so you can ship the game, not the plumbing.
                    </p>
                </Reveal>
                <div className="grid gap-4 lg:grid-cols-6">
                    {FEATURES.map((feature, index) => (
                        <Reveal key={feature.title} className={feature.span} delayMs={index * 60}>
                            <Card className="h-full transition-colors hover:border-foreground/20">
                                <CardHeader>
                                    <div className="flex size-9 items-center justify-center rounded-md border bg-card">
                                        <feature.icon className="size-4 text-foreground" />
                                    </div>
                                    <CardTitle className="pt-2 text-base">{feature.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">{feature.body}</CardContent>
                            </Card>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="border-y bg-muted/20">
                <div className="mx-auto w-full max-w-6xl px-6 py-20">
                    <Reveal>
                        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
                    </Reveal>
                    <div className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="pointer-events-none absolute left-0 right-0 top-4 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
                        {STEPS.map((step, index) => (
                            <Reveal key={step.n} delayMs={index * 80}>
                                <div className="relative space-y-2">
                                    <div className="flex size-8 items-center justify-center rounded-full border bg-background font-mono text-sm">
                                        {step.n}
                                    </div>
                                    <h3 className="font-medium">{step.title}</h3>
                                    <p className="text-sm text-muted-foreground">{step.body}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Code */}
            <section className="mx-auto w-full max-w-6xl px-6 py-20">
                <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
                    <Reveal className="min-w-0">
                        <div className="lg:sticky lg:top-24">
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                One call in, one call out
                            </h2>
                            <p className="mt-3 text-muted-foreground">
                                Post a queue entry from your game server. When the engine forms a match, it calls you
                                back with a signed webhook — no polling, no engine to maintain.
                            </p>
                            <Link href="/demo" className="mt-6 inline-block">
                                <Button variant="outline">
                                    Try it live
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>
                        </div>
                    </Reveal>
                    <div className="min-w-0 space-y-4">
                        <Reveal className="min-w-0">
                            <CodeWindow title="enqueue.sh" code={ENQUEUE_SNIPPET} />
                        </Reveal>
                        <Reveal delayMs={80} className="min-w-0">
                            <CodeWindow title="match.created" code={WEBHOOK_SNIPPET} />
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="border-t bg-muted/20">
                <div className="mx-auto w-full max-w-3xl px-6 py-20">
                    <Reveal>
                        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                            Frequently asked
                        </h2>
                    </Reveal>
                    <Reveal>
                        <Faq />
                    </Reveal>
                </div>
            </section>

            {/* CTA */}
            <section className="mx-auto w-full max-w-6xl px-6 py-20">
                <Reveal>
                    <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-transparent">
                        <div className="pointer-events-none absolute inset-0 bg-grid [background-size:36px_36px] [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,black,transparent)]" />
                        <CardContent className="relative flex flex-col items-center gap-4 py-14 text-center">
                            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                Start matchmaking in minutes
                            </h2>
                            <p className="max-w-md text-sm text-muted-foreground">
                                Create a project, drop in an API key, and send your first queue entry.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <Link href="/register">
                                    <Button size="lg">
                                        Start free
                                        <ArrowRight className="size-4" />
                                    </Button>
                                </Link>
                                <Link href="/demo">
                                    <Button size="lg" variant="outline">
                                        See the demo
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </Reveal>
            </section>

            <footer className="border-t">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
                    <span>Matching Hub — matchmaking, ratings, and event delivery.</span>
                    <span>Multi-tenant · slot-based matches · internal Elo or external ratings</span>
                </div>
            </footer>
        </main>
    );
}
