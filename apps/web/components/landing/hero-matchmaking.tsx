"use client";

import * as React from "react";
import { Check, Swords, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Player = { id: number; name: string; rating: number };

const NAMES = ["nova", "kai", "echo", "rin", "zed", "mira", "ace", "lux", "jin", "vex", "imp", "ovi"];
let uid = 0;

function rand(max: number) {
    return Math.floor(Math.random() * max);
}

function sign() {
    return Math.random() < 0.5 ? -1 : 1;
}

function makePlayer(rating: number): Player {
    return { id: (uid += 1), name: `${NAMES[rand(NAMES.length)]}_${rand(90) + 10}`, rating };
}

type Round = {
    anchor: Player;
    candidates: Player[];
    winner: Player;
    steps: number[]; // expanding window values, last one is where the match forms
};

// Build a round where the rating window must expand before the closest-rated
// candidate falls in range — the whole point of skill-based matchmaking.
function makeRound(): Round {
    const anchorRating = 1350 + rand(360);
    const anchor = makePlayer(anchorRating);

    // Deltas chosen so the best match needs at least one window expansion (>50).
    const deltas = [70 + rand(45), 150 + rand(70), 115 + rand(55)];
    const candidates = deltas.map((delta) => makePlayer(anchorRating + sign() * delta));
    // shuffle so the winner isn't always first
    candidates.sort(() => Math.random() - 0.5);

    const winner = candidates.reduce((best, candidate) =>
        Math.abs(candidate.rating - anchorRating) < Math.abs(best.rating - anchorRating) ? candidate : best,
    );
    const bestDelta = Math.abs(winner.rating - anchorRating);

    const steps = [50];
    while (steps[steps.length - 1] < bestDelta) {
        steps.push(steps[steps.length - 1] + 50);
    }
    return { anchor, candidates, winner, steps };
}

export function HeroMatchmaking() {
    // Empty initial state so SSR and first client render match (no hydration drift);
    // randomness only runs in the effect below.
    const [anchor, setAnchor] = React.useState<Player | null>(null);
    const [candidates, setCandidates] = React.useState<Player[]>([]);
    const [windowSize, setWindowSize] = React.useState(50);
    const [winnerId, setWinnerId] = React.useState<number | null>(null);

    React.useEffect(() => {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            const staticRound = makeRound();
            setAnchor(staticRound.anchor);
            setCandidates(staticRound.candidates);
            setWindowSize(staticRound.steps[staticRound.steps.length - 1]);
            setWinnerId(staticRound.winner.id);
            return;
        }

        const control = { stopped: false };
        const timers: ReturnType<typeof setTimeout>[] = [];
        const wait = (fn: () => void, ms: number) =>
            timers.push(
                setTimeout(() => {
                    if (!control.stopped) fn();
                }, ms),
            );

        function round() {
            if (control.stopped) return;
            timers.length = 0; // previous round's timers have all fired
            const next = makeRound();
            setWinnerId(null);
            setAnchor(next.anchor);
            setCandidates(next.candidates);
            setWindowSize(next.steps[0]);

            let t = 600;
            for (const step of next.steps.slice(1)) {
                const value = step;
                wait(() => setWindowSize(value), t);
                t += 1000;
            }
            t += 700;
            wait(() => setWinnerId(next.winner.id), t);
            t += 2600;
            wait(() => round(), t);
        }

        round();
        return () => {
            control.stopped = true;
            for (const timer of timers) clearTimeout(timer);
        };
    }, []);

    const winner = candidates.find((candidate) => candidate.id === winnerId) ?? null;

    return (
        <div className="relative w-full">
            <div className="pointer-events-none absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
            <div className="relative flex min-h-[360px] flex-col gap-3 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-xs">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-2 rounded-full bg-success animate-pulse-ring" />
                        <span className="relative inline-flex size-2 rounded-full bg-success" />
                    </span>
                    <span className="font-medium">Skill-based matchmaking</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">skill · 1v1</span>
                </div>

                {/* Anchor + its expanding rating window */}
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Target className="size-3" />
                        Matching
                        <span className="ml-auto font-mono text-foreground">
                            ±{windowSize}
                            <span className="text-muted-foreground"> window</span>
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-muted-foreground">{anchor?.name ?? "—"}</span>
                        <span className="font-mono">{anchor?.rating ?? "····"}</span>
                    </div>
                </div>

                {/* Candidates, lit up when they fall inside the window */}
                <div className="flex-1 rounded-lg border bg-background/40 p-3">
                    <div className="mb-2 text-[11px] text-muted-foreground">Candidates · closest rating wins</div>
                    <div className="flex flex-col gap-2">
                        {candidates.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/70">Scanning the pool…</p>
                        ) : (
                            candidates.map((candidate) => {
                                const delta = anchor ? Math.abs(candidate.rating - anchor.rating) : 0;
                                const inRange = anchor !== null && delta <= windowSize;
                                const isWinner = candidate.id === winnerId;
                                return (
                                    <div
                                        key={candidate.id}
                                        className={cn(
                                            "flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-300",
                                            isWinner
                                                ? "border-success/50 bg-success/10"
                                                : inRange
                                                  ? "border-success/30 bg-success/5"
                                                  : "opacity-60",
                                        )}
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="font-mono text-muted-foreground">{candidate.name}</span>
                                            <span className="font-mono">{candidate.rating}</span>
                                        </span>
                                        <span className="flex items-center gap-1.5 font-mono text-[10px]">
                                            <span className={inRange ? "text-success" : "text-muted-foreground"}>
                                                Δ{delta}
                                            </span>
                                            {inRange ? <Check className="size-3 text-success" /> : null}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Result */}
                <div className="rounded-lg border bg-background/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Trophy className="size-3 text-success" />
                        Match
                    </div>
                    {anchor && winner ? (
                        <div className="animate-fade-in rounded-md border border-success/40 bg-success/5 p-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="flex-1 truncate font-mono text-xs">
                                    {anchor.name} · {anchor.rating}
                                </span>
                                <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                    <Swords className="size-3" />
                                    vs
                                </span>
                                <span className="flex-1 truncate text-right font-mono text-xs">
                                    {winner.name} · {winner.rating}
                                </span>
                            </div>
                            <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">
                                paired within ±{windowSize} · Δ{Math.abs(anchor.rating - winner.rating)} rating
                            </p>
                        </div>
                    ) : (
                        <p className="text-[11px] text-muted-foreground/70">Widening the window until someone fits…</p>
                    )}
                </div>
            </div>
        </div>
    );
}
