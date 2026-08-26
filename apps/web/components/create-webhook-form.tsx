"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createWebhook, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WEBHOOK_EVENTS = [
    "match.created",
    "match.pending_acceptance",
    "match.ready_check_timeout",
    "match.declined",
    "match.completed",
    "match.failed",
    "match.disputed",
    "match.resolved",
    "queue.timeout",
    "rating.updated",
    "player.penalty_issued",
    "player.penalty_revoked",
];

const initialState: FormState = {};

export function CreateWebhookForm({ projectId }: { projectId: string }) {
    const [state, action, pending] = useActionState(createWebhook, initialState);

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                    id="url"
                    name="url"
                    type="url"
                    placeholder="https://game.example.com/hook"
                    required
                    disabled={pending}
                />
                <p className="text-xs text-muted-foreground">
                    Must be an absolute HTTPS URL capable of receiving JSON POST payloads.
                </p>
            </div>

            <div className="space-y-3">
                <Label>Events to subscribe</Label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {WEBHOOK_EVENTS.map((event) => (
                        <label
                            key={event}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-xs transition-colors hover:bg-muted/50"
                        >
                            <input
                                type="checkbox"
                                name="events"
                                value={event}
                                className="size-3.5 rounded border-border accent-foreground"
                                disabled={pending}
                            />
                            <span className="font-mono text-xs text-foreground/90">{event}</span>
                        </label>
                    ))}
                </div>
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save webhook"}
                </Button>
                <Button asChild variant="ghost" disabled={pending}>
                    <Link href={`/dashboard/projects/${projectId}/webhooks`}>Cancel</Link>
                </Button>
            </div>
        </form>
    );
}
