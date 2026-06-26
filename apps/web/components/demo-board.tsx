"use client";

import * as React from "react";
import { Shuffle, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DemoMode = "skill" | "casual";

type QueuedPlayer = { queueEntryId: string; playerId: string; rating: number; addedAt: number };
type MatchSlot = { slotIndex: number; groupIndex: number; members: { playerId: string; rating: number | null }[] };
type MatchView = { id: string; at: number; slots: MatchSlot[] };
type LogLine = { at: number; text: string };

export function DemoBoard({
    skillWindow,
}: {
    skillWindow: { initial: number; intervalSeconds: number; step: number };
}) {
    const [mode, setMode] = React.useState<DemoMode>("skill");
    const [rating, setRating] = React.useState(1500);
    const [queued, setQueued] = React.useState<QueuedPlayer[]>([]);
    const [matches, setMatches] = React.useState<MatchView[]>([]);
    const [log, setLog] = React.useState<LogLine[]>([]);
    const [pending, setPending] = React.useState(false);
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const addLog = React.useCallback((text: string) => {
        setLog((lines) => [{ at: Date.now(), text }, ...lines].slice(0, 40));
    }, []);

    const effectiveWindow = React.useCallback(
        (addedAt: number) => {
            const elapsed = (now - addedAt) / 1000;
            const expansions = Math.floor(elapsed / skillWindow.intervalSeconds);
            return skillWindow.initial + expansions * skillWindow.step;
        },
        [now, skillWindow],
    );

    async function addPlayer(value: number) {
        if (pending) return;
        setPending(true);
        try {
            const response = await fetch("/api/demo/enqueue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, rating: value }),
            });
            if (!response.ok) {
                addLog("enqueue failed");
                return;
            }
            const result = (await response.json()) as {
                queueEntryId: string;
                status: string;
                matchId: string | null;
                playerId: string;
                rating: number;
            };
            addLog(`enqueued ${result.playerId} · ${result.rating}`);

            if (result.matchId) {
                const matchResponse = await fetch(`/api/demo/match?id=${result.matchId}`);
                if (matchResponse.ok) {
                    const match = (await matchResponse.json()) as { id: string; slots: MatchSlot[] };
                    const matchedIds = new Set(match.slots.flatMap((slot) => slot.members.map((m) => m.playerId)));
                    setQueued((list) => list.filter((player) => !matchedIds.has(player.playerId)));
                    setMatches((list) => [{ id: match.id, at: Date.now(), slots: match.slots }, ...list].slice(0, 12));
                    addLog(`★ match.created · ${[...matchedIds].join(" vs ")}`);
                }
            } else {
                setQueued((list) => [
                    ...list,
                    {
                        queueEntryId: result.queueEntryId,
                        playerId: result.playerId,
                        rating: result.rating,
                        addedAt: Date.now(),
                    },
                ]);
            }
        } finally {
            setPending(false);
        }
    }

    async function reset() {
        const ids = queued.map((player) => player.queueEntryId);
        setQueued([]);
        setMatches([]);
        setLog([]);
        if (ids.length > 0) {
            await fetch("/api/demo/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ queueEntryIds: ids }),
            }).catch(() => undefined);
        }
    }

    async function switchMode(next: DemoMode) {
        if (next === mode) return;
        await reset();
        setMode(next);
    }

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card>
                <CardContent className="flex flex-col gap-4 pt-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={mode === "skill" ? "default" : "outline"}
                            size="sm"
                            onClick={() => switchMode("skill")}
                        >
                            <Swords className="size-4" />
                            Skill 1v1
                        </Button>
                        <Button
                            variant={mode === "casual" ? "default" : "outline"}
                            size="sm"
                            onClick={() => switchMode("casual")}
                        >
                            Casual 1v1
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {mode === "skill"
                                ? `Matches within a rating window that starts at ${skillWindow.initial} and grows +${skillWindow.step} every ${skillWindow.intervalSeconds}s.`
                                : "Matches any two players as soon as both are waiting."}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                            <label htmlFor="rating" className="text-xs text-muted-foreground">
                                Rating
                            </label>
                            <Input
                                id="rating"
                                type="number"
                                min={100}
                                max={4000}
                                value={rating}
                                onChange={(event) => setRating(Number(event.target.value) || 0)}
                                className="w-28"
                            />
                        </div>
                        <Button onClick={() => addPlayer(rating)} disabled={pending}>
                            Add player
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => addPlayer(800 + Math.floor(Math.random() * 1400))}
                            disabled={pending}
                        >
                            <Shuffle className="size-4" />
                            Add random
                        </Button>
                        <Button variant="ghost" onClick={reset} disabled={pending}>
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Queue */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Queue · {queued.length} waiting</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {queued.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Add players to fill the pool.</p>
                        ) : (
                            <ul className="space-y-2">
                                {queued.map((player) => {
                                    const waited = Math.max(0, Math.floor((now - player.addedAt) / 1000));
                                    return (
                                        <li
                                            key={player.queueEntryId}
                                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {player.playerId}
                                                </span>
                                                <span className="font-mono">{player.rating}</span>
                                            </span>
                                            <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {mode === "skill" ? (
                                                    <span>±{effectiveWindow(player.addedAt)} window</span>
                                                ) : null}
                                                <span>{waited}s</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {/* Matches */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Matches · {matches.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {matches.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No matches yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {matches.map((match) => (
                                    <li key={match.id} className="rounded-md border p-3">
                                        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Trophy className="size-3 text-success" />
                                            <span className="font-mono">{match.id.slice(0, 12)}…</span>
                                            <span>{ratingDelta(match)}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {match.slots.map((slot) => (
                                                <span
                                                    key={slot.slotIndex}
                                                    className={cn(
                                                        "rounded-md border px-2 py-1 text-xs",
                                                        slot.groupIndex === 1 ? "bg-muted/40" : "bg-card",
                                                    )}
                                                >
                                                    <span className="text-muted-foreground">G{slot.groupIndex} </span>
                                                    {slot.members
                                                        .map((m) => `${m.playerId} · ${m.rating ?? "—"}`)
                                                        .join(", ")}
                                                </span>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Event log */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Events</CardTitle>
                </CardHeader>
                <CardContent>
                    {log.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Activity will show up here.</p>
                    ) : (
                        <ul className="space-y-1 font-mono text-xs">
                            {log.map((line) => (
                                <li key={`${line.at}-${line.text}`} className="text-muted-foreground">
                                    <span className="text-foreground">{line.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ratingDelta(match: MatchView): string {
    const ratings = match.slots
        .flatMap((slot) => slot.members.map((m) => m.rating))
        .filter((r): r is number => r != null);
    if (ratings.length < 2) return "";
    const delta = Math.max(...ratings) - Math.min(...ratings);
    return `Δ ${delta}`;
}