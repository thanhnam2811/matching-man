import * as React from "react";
import Link from "next/link";
import { ArrowRight, Play, Sparkles, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "./reveal";

export function BottomCta() {
    return (
        <section className="mx-auto w-full max-w-6xl px-6 py-20">
            <Reveal>
                <Card className="relative overflow-hidden border-border bg-gradient-to-br from-card via-card to-muted/30 shadow-md">
                    <div className="pointer-events-none absolute inset-0 bg-grid [background-size:36px_36px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
                    <CardContent className="relative flex flex-col items-center gap-6 py-16 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                            <Sparkles className="size-3.5 text-foreground" />
                            Production-Ready Matchmaking
                        </span>
                        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                            Start matchmaking in under five minutes
                        </h2>
                        <p className="max-w-md text-sm text-muted-foreground">
                            Create a project, generate an API key, and send your first queue entry. No credit card
                            required.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Link href="/register">
                                <Button size="lg" className="shadow-xs">
                                    Start free
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>
                            <Link href="/demo">
                                <Button size="lg" variant="outline">
                                    <Play className="size-3.5 text-success" />
                                    Explore live demo
                                </Button>
                            </Link>
                        </div>

                        {/* Quick terminal command pill */}
                        <div className="mt-4 flex items-center gap-2 rounded-lg border bg-background/80 px-3.5 py-2 font-mono text-xs text-muted-foreground shadow-inner">
                            <Terminal className="size-3.5 text-muted-foreground" />
                            <span>pnpm add @matching-hub/sdk</span>
                        </div>
                    </CardContent>
                </Card>
            </Reveal>
        </section>
    );
}
