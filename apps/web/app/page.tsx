import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
    return (
        <main className="relative flex min-h-screen flex-col">
            <header className="flex h-14 items-center justify-between px-6">
                <span className="flex items-center gap-2 font-semibold">
                    <span className="inline-block size-2 rounded-full bg-success" />
                    Matching Hub
                </span>
                <div className="flex items-center gap-2">
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

            <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                    Matchmaking infrastructure for your game
                </h1>
                <p className="mt-4 max-w-xl text-balance text-muted-foreground">
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
            </section>

            <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
                Multi-tenant control plane · slot-based matches · internal Elo or external ratings
            </footer>
        </main>
    );
}