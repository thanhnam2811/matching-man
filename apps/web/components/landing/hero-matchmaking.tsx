"use client";

import * as React from "react";
import { Swords, Trophy, Users } from "lucide-react";

type Chip = { id: number; name: string; rating: number };

const NAMES = ["nova", "kai", "echo", "rin", "zed", "mira", "ace", "lux", "jin", "vex"];
let uid = 0;

function makeChip(): Chip {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    return {
        id: (uid += 1),
        name: `${name}_${Math.floor(Math.random() * 90 + 10)}`,
        rating: 1200 + Math.floor(Math.random() * 900),
    };
}

export function HeroMatchmaking() {
    // Start empty so SSR and the first client render agree (no hydration mismatch);
    // randomness only runs in the effect below, on the client.
    const [queue, setQueue] = React.useState<Chip[]>([]);
    const [match, setMatch] = React.useState<[Chip, Chip] | null>(null);

    React.useEffect(() => {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            setQueue([makeChip()]);
            setMatch([makeChip(), makeChip()]);
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
            const a = makeChip();
            const b = makeChip();
            setMatch(null);
            setQueue([]);
            wait(() => setQueue([a]), 600);
            wait(() => setQueue([a, b]), 1600);
            wait(() => {
                setQueue([]);
                setMatch([a, b]);
            }, 2700);
            wait(() => round(), 4800);
        }

        round();
        return () => {
            control.stopped = true;
            for (const timer of timers) clearTimeout(timer);
        };
    }, []);

    return (
        <div className="relative w-full">
            <div className="pointer-events-none absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />
            <div className="relative flex h-[320px] flex-col gap-3 rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur sm:h-[360px]">
                <div className="flex items-center gap-2 text-xs">
                    <span className="relative flex size-2">
                        <span className="absolute inline-flex size-2 rounded-full bg-success animate-pulse-ring" />
                        <span className="relative inline-flex size-2 rounded-full bg-success" />
                    </span>
                    <span className="font-medium">Live matchmaking</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">skill · 1v1</span>
                </div>

                {/* Queue */}
                <div className="flex-1 rounded-lg border bg-background/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Users className="size-3" />
                        Queue · {queue.length} waiting
                    </div>
                    <div className="flex flex-col gap-2">
                        {queue.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/70">Players entering the pool…</p>
                        ) : (
                            queue.map((chip) => <PlayerChip key={chip.id} chip={chip} />)
                        )}
                    </div>
                </div>

                {/* Match */}
                <div className="rounded-lg border bg-background/40 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Trophy className="size-3 text-success" />
                        Match
                    </div>
                    {match ? (
                        <div className="animate-fade-in rounded-md border border-success/40 bg-success/5 p-2">
                            <div className="flex items-center justify-between gap-2">
                                <PlayerChip chip={match[0]} flush />
                                <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                    <Swords className="size-3" />
                                    vs
                                </span>
                                <PlayerChip chip={match[1]} flush />
                            </div>
                            <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">
                                Δ {Math.abs(match[0].rating - match[1].rating)} rating
                            </p>
                        </div>
                    ) : (
                        <p className="text-[11px] text-muted-foreground/70">Waiting for a compatible pair…</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function PlayerChip({ chip, flush = false }: { chip: Chip; flush?: boolean }) {
    return (
        <span
            className={`flex animate-fade-in items-center justify-between gap-3 rounded-md border bg-card px-2.5 py-1.5 text-xs ${
                flush ? "flex-1" : ""
            }`}
        >
            <span className="font-mono text-muted-foreground">{chip.name}</span>
            <span className="font-mono">{chip.rating}</span>
        </span>
    );
}
