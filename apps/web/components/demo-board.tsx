"use client";

import * as React from "react";
import { Shuffle, Swords, Trophy, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type DemoMode = "skill" | "casual";
type ServerStatus = "checking" | "waking" | "ready";

type QueuedPlayer = { queueEntryId: string; playerId: string; rating: number; addedAt: number; syncing?: boolean };
type MatchSlot = { slotIndex: number; groupIndex: number; members: { playerId: string; rating: number | null }[] };
type MatchView = { id: string; at: number; slots: MatchSlot[] };
type LogLine = { at: number; text: string };

const MATCHED_BADGE_MS = 1700;
const MATCHED_REMOVE_MS = 2000;

export function DemoBoard({
    skillWindow,
}: {
    skillWindow: { initial: number; intervalSeconds: number; step: number };
}) {
    const [mode, setMode] = React.useState<DemoMode>("skill");
    const [rating, setRating] = React.useState(1500);
    const [queued, setQueued] = React.useState<QueuedPlayer[]>([]);
    const [matchedQueueEntryIds, setMatchedQueueEntryIds] = React.useState<Set<string>>(new Set());
    const [leavingQueueEntryIds, setLeavingQueueEntryIds] = React.useState<Set<string>>(new Set());
    const [matches, setMatches] = React.useState<MatchView[]>([]);
    const [log, setLog] = React.useState<LogLine[]>([]);
    const [pending, setPending] = React.useState(false);
    const [server, setServer] = React.useState<ServerStatus>("checking");
    const [now, setNow] = React.useState(() => Date.now());
    const [serverCheckStartedAt] = React.useState(() => Date.now());

    React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // Mirrors `queued` synchronously so match-exit-animation timers can read the
    // latest list without waiting for a re-render round trip.
    const queuedRef = React.useRef<QueuedPlayer[]>([]);
    React.useEffect(() => {
        queuedRef.current = queued;
    }, [queued]);

    const timersRef = React.useRef<number[]>([]);
    React.useEffect(() => {
        return () => {
            timersRef.current.forEach((id) => window.clearTimeout(id));
        };
    }, []);

    // Warm the free-tier server on mount and reflect its state, so the first
    // "Add player" doesn't sit on a frozen-looking button during a cold start.
    React.useEffect(() => {
        // Wrapped in an object so the cleanup's mutation is visible to the loop
        // (a plain `let` trips oxlint's no-unmodified-loop-condition).
        const state = { cancelled: false };
        let attempt = 0;

        async function probe() {
            while (!state.cancelled) {
                try {
                    const response = await fetch("/api/demo/health", { cache: "no-store" });
                    const data = (await response.json()) as { ok?: boolean };
                    if (data?.ok) {
                        if (!state.cancelled) setServer("ready");
                        return;
                    }
                } catch {
                    // fall through to retry
                }
                attempt += 1;
                if (!state.cancelled) setServer("waking");
                await new Promise((resolve) => setTimeout(resolve, Math.min(2000 + attempt * 1000, 6000)));
            }
        }

        void probe();
        return () => {
            state.cancelled = true;
        };
    }, []);

    // Matching now runs in the background after enqueue responds, so polling
    // loops can outlive the component (unmount mid-poll) and two different
    // players' loops can independently discover the same match.
    const pollCancelledRef = React.useRef(false);
    const handledMatchIdsRef = React.useRef(new Set<string>());
    React.useEffect(() => {
        return () => {
            pollCancelledRef.current = true;
        };
    }, []);

    const addLog = React.useCallback((text: string) => {
        setLog((lines) => [{ at: Date.now(), text }, ...lines].slice(0, 40));
    }, []);

    // A match keeps its two queue entries visible with a "Matched!" badge for a
    // beat before they fade out, instead of vanishing from the queue instantly.
    const applyMatch = React.useCallback(
        (match: { id: string; slots: MatchSlot[] }, selfEntry?: { queueEntryId: string; playerId: string }) => {
            const matchedPlayerIds = new Set(match.slots.flatMap((slot) => slot.members.map((m) => m.playerId)));

            const idsToAnimate = new Set<string>();
            for (const player of queuedRef.current) {
                if (matchedPlayerIds.has(player.playerId)) idsToAnimate.add(player.queueEntryId);
            }
            if (selfEntry && matchedPlayerIds.has(selfEntry.playerId)) {
                idsToAnimate.add(selfEntry.queueEntryId);
            }

            setMatches((list) => [{ id: match.id, at: Date.now(), slots: match.slots }, ...list].slice(0, 12));
            addLog(`★ match.created · ${[...matchedPlayerIds].join(" vs ")}`);
            toast({ title: "Match created", description: [...matchedPlayerIds].join("  vs  "), variant: "success" });

            if (idsToAnimate.size === 0) return;

            setMatchedQueueEntryIds((prev) => new Set([...prev, ...idsToAnimate]));

            const badgeTimer = window.setTimeout(() => {
                setLeavingQueueEntryIds((prev) => new Set([...prev, ...idsToAnimate]));
            }, MATCHED_BADGE_MS);

            const removeTimer = window.setTimeout(() => {
                setQueued((list) => list.filter((player) => !idsToAnimate.has(player.queueEntryId)));
                setMatchedQueueEntryIds((prev) => {
                    const next = new Set(prev);
                    idsToAnimate.forEach((id) => next.delete(id));
                    return next;
                });
                setLeavingQueueEntryIds((prev) => {
                    const next = new Set(prev);
                    idsToAnimate.forEach((id) => next.delete(id));
                    return next;
                });
            }, MATCHED_REMOVE_MS);

            timersRef.current.push(badgeTimer, removeTimer);
        },
        [addLog],
    );

    // Removes a player whose queue entry ended without a match (timeout/cancel).
    const dropFromQueue = React.useCallback(
        (queueEntryId: string, reason: string) => {
            const player = queuedRef.current.find((entry) => entry.queueEntryId === queueEntryId);
            setQueued((list) => list.filter((entry) => entry.queueEntryId !== queueEntryId));
            if (player) addLog(`${reason} · ${player.playerId}`);
        },
        [addLog],
    );

    const pollForMatch = React.useCallback(
        async (queueEntryId: string) => {
            // Poll until the entry reaches a terminal state (matched / cancelled /
            // timed out) instead of a fixed short window: skill matches formed by
            // the 20s server sweep can take 20-30s+ to appear (issue #18). Fast
            // cadence at first so instant matches feel instant, then a backoff to
            // stay friendly to the free-tier API. The hard cap sits past the demo
            // mode's max queue time (300s), by which point the entry has timed out.
            const deadline = Date.now() + 6 * 60 * 1000;
            const fastUntil = Date.now() + 6000;

            while (Date.now() < deadline && !pollCancelledRef.current) {
                await new Promise((resolve) => setTimeout(resolve, Date.now() < fastUntil ? 400 : 2000));
                if (pollCancelledRef.current) return;

                try {
                    const entryResponse = await fetch(`/api/demo/queue-entry?id=${queueEntryId}`);
                    if (!entryResponse.ok) continue;
                    const entry = (await entryResponse.json()) as { status: string; matchId: string | null };

                    if (entry.status === "timed_out" || entry.status === "cancelled") {
                        dropFromQueue(queueEntryId, entry.status === "timed_out" ? "queue.timeout" : "dequeued");
                        return;
                    }
                    // Another player's loop already rendered this match (it removes
                    // both queue cards), so this loop is done.
                    if (entry.matchId && handledMatchIdsRef.current.has(entry.matchId)) return;
                    if (!entry.matchId) continue;

                    const matchResponse = await fetch(`/api/demo/match?id=${entry.matchId}`);
                    if (!matchResponse.ok) return;
                    const match = (await matchResponse.json()) as { id: string; slots: MatchSlot[] };
                    if (pollCancelledRef.current || handledMatchIdsRef.current.has(match.id)) return;
                    handledMatchIdsRef.current.add(match.id);

                    applyMatch(match);
                    return;
                } catch {
                    // transient network error - keep polling until the deadline
                }
            }
        },
        [applyMatch, dropFromQueue],
    );

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
        if (server !== "ready") {
            toast({
                title: "Server is still warming up",
                description: "Free-tier cold start — give it a few seconds and try again.",
                variant: "warning",
            });
            return;
        }

        setPending(true);
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        // Optimistic insert: the player shows in the queue immediately while the request is in flight.
        setQueued((list) => [
            ...list,
            { queueEntryId: tempId, playerId: "joining…", rating: value, addedAt: Date.now(), syncing: true },
        ]);

        try {
            const response = await fetch("/api/demo/enqueue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode, rating: value }),
            });
            if (!response.ok) {
                setQueued((list) => list.filter((player) => player.queueEntryId !== tempId));
                addLog("enqueue failed");
                toast({
                    title: "Enqueue failed",
                    description: "The demo server didn't accept the request.",
                    variant: "destructive",
                });
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

            // Reconcile the optimistic placeholder with the real queue entry.
            setQueued((list) =>
                list.map((player) =>
                    player.queueEntryId === tempId
                        ? {
                              queueEntryId: result.queueEntryId,
                              playerId: result.playerId,
                              rating: result.rating,
                              addedAt: player.addedAt,
                          }
                        : player,
                ),
            );

            if (result.matchId) {
                const matchResponse = await fetch(`/api/demo/match?id=${result.matchId}`);
                if (matchResponse.ok) {
                    const match = (await matchResponse.json()) as { id: string; slots: MatchSlot[] };
                    applyMatch(match, { queueEntryId: result.queueEntryId, playerId: result.playerId });
                }
            } else {
                // Matching runs in the background after enqueue responds — poll the
                // queue entry endpoint to learn when this player has been matched.
                pollForMatch(result.queueEntryId);
            }
        } catch {
            setQueued((list) => list.filter((player) => player.queueEntryId !== tempId));
            toast({ title: "Network error", description: "Couldn't reach the demo server.", variant: "destructive" });
        } finally {
            setPending(false);
        }
    }

    async function reset() {
        const ids = queued.filter((player) => !player.syncing).map((player) => player.queueEntryId);
        setQueued([]);
        setMatches([]);
        setLog([]);
        setMatchedQueueEntryIds(new Set());
        setLeavingQueueEntryIds(new Set());
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

    const ready = server === "ready";

    return (
        <div className="space-y-6">
            <ServerBanner
                status={server}
                elapsedSeconds={Math.max(0, Math.floor((now - serverCheckStartedAt) / 1000))}
            />

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
                            <div className="relative">
                                <Input
                                    id="rating"
                                    type="number"
                                    min={100}
                                    max={4000}
                                    value={rating}
                                    onChange={(event) => setRating(Number(event.target.value) || 0)}
                                    className="w-32 pr-8"
                                />
                                <button
                                    type="button"
                                    onClick={() => setRating(800 + Math.floor(Math.random() * 1400))}
                                    className="absolute inset-y-0 right-1 flex items-center rounded-sm px-1 text-muted-foreground transition-colors hover:text-foreground"
                                    aria-label="Randomize rating"
                                    title="Randomize rating"
                                >
                                    <Shuffle className="size-3.5" />
                                </button>
                            </div>
                        </div>
                        <Button onClick={() => addPlayer(rating)} loading={pending} disabled={!ready}>
                            {pending ? "Adding…" : "Add player"}
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
                                    const matched = matchedQueueEntryIds.has(player.queueEntryId);
                                    const leaving = leavingQueueEntryIds.has(player.queueEntryId);
                                    return (
                                        <li
                                            key={player.queueEntryId}
                                            className={cn(
                                                "flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-all duration-300",
                                                player.syncing && "opacity-60",
                                                matched && "border-success/50 bg-success/10",
                                                leaving && "scale-95 opacity-0",
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {player.playerId}
                                                </span>
                                                <span className="font-mono">{player.rating}</span>
                                            </span>
                                            <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {matched ? (
                                                    <Badge variant="success">Matched!</Badge>
                                                ) : player.syncing ? (
                                                    <Spinner size="sm" />
                                                ) : (
                                                    <>
                                                        {mode === "skill" ? (
                                                            <span>±{effectiveWindow(player.addedAt)} window</span>
                                                        ) : null}
                                                        <span>{waited}s</span>
                                                    </>
                                                )}
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
                                    <li key={match.id} className="animate-fade-in rounded-md border p-3">
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

function ServerBanner({ status, elapsedSeconds }: { status: ServerStatus; elapsedSeconds: number }) {
    if (status === "ready") return null;
    return (
        <div className="flex items-center gap-3 rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
            <Spinner size="lg" className="text-warning" />
            <span className="text-muted-foreground">
                {status === "checking" ? (
                    <>Connecting to the demo server…</>
                ) : (
                    <>
                        <span className="text-foreground">Waking the demo server.</span> It sleeps on the free tier, so
                        the first start can take ~30s. Adding is disabled until it&apos;s ready.
                    </>
                )}
            </span>
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Wifi className="size-4" />
                {elapsedSeconds}s
            </span>
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
