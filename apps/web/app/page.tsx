import Link from "next/link";
import { ArrowRight, Boxes, Building2, Gauge, Sparkles, Trophy, Users, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURES = [
    {
        icon: Users,
        title: "Team-based by default",
        body: "Solo is a team of one, parties are teams of N, and team-vs-team fits without rebuilding the model.",
    },
    {
        icon: Trophy,
        title: "Skill or neutral",
        body: "Internal Elo, bring-your-own external ratings, or disabled — chosen per game mode.",
    },
    {
        icon: Gauge,
        title: "Expanding rating window",
        body: "Tight matches first; the allowed skill gap widens over time so nobody waits forever.",
    },
    {
        icon: Boxes,
        title: "Slot-based matches",
        body: "1v1, 5v5, or free-for-all expressed as slots and groups — versus and FFA from one engine.",
    },
    {
        icon: Webhook,
        title: "Signed, retried webhooks",
        body: "HMAC-signed delivery with exponential backoff and a full delivery log you can inspect.",
    },
    {
        icon: Building2,
        title: "Multi-tenant dashboard",
        body: "Organizations, projects, API keys, environments, and role-based access out of the box.",
    },
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
            <header className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
                <span className="flex items-center gap-2 font-semibold">
                    <span className="inline-block size-2 rounded-full bg-success" />
                    Matching Hub
                </span>
                <div className="flex items-center gap-2">
                    <Link href="/demo">
                        <Button variant="ghost" size="sm">
                            Demo
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button variant="ghost" size="sm">
                            Sign in
                        </Button>
                    </Link>
                    <Link href="/register">
                        <Button size="sm">Start free</Button>
                    </Link>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-primary/10 to-transparent" />
                <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                        <Sparkles className="size-3" />
                        Matchmaking as a service
                    </span>
                    <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
                        Matchmaking infrastructure for your game
                    </h1>
                    <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground">
                        Queue teams, match by skill, and deliver results through signed webhooks — without building the
                        engine yourself.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
                </div>
            </section>

            {/* Features */}
            <section className="mx-auto w-full max-w-6xl px-6 py-16">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((feature) => (
                        <Card key={feature.title}>
                            <CardHeader>
                                <div className="flex size-9 items-center justify-center rounded-md border bg-card">
                                    <feature.icon className="size-4 text-foreground" />
                                </div>
                                <CardTitle className="pt-2 text-base">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">{feature.body}</CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="mx-auto w-full max-w-6xl px-6 py-16">
                <h2 className="text-center text-2xl font-semibold tracking-tight">How it works</h2>
                <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((step) => (
                        <div key={step.n} className="space-y-2">
                            <div className="flex size-8 items-center justify-center rounded-full border font-mono text-sm">
                                {step.n}
                            </div>
                            <h3 className="font-medium">{step.title}</h3>
                            <p className="text-sm text-muted-foreground">{step.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Code */}
            <section className="mx-auto w-full max-w-6xl px-6 py-16">
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">Enqueue a team</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="overflow-x-auto rounded-md bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                                {ENQUEUE_SNIPPET}
                            </pre>
                        </CardContent>
                    </Card>
                    <Card className="overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-sm text-muted-foreground">Receive the match</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="overflow-x-auto rounded-md bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                                {WEBHOOK_SNIPPET}
                            </pre>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* CTA */}
            <section className="mx-auto w-full max-w-6xl px-6 pb-24">
                <Card className="bg-gradient-to-br from-primary/10 to-transparent">
                    <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                        <h2 className="text-2xl font-semibold tracking-tight">Start matchmaking in minutes</h2>
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
