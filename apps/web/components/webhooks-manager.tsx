"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createWebhook, deleteWebhook, type FormState, setWebhookActive } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";

type Webhook = {
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
};

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

export function WebhooksManager({ projectId, webhooks }: { projectId: string; webhooks: Webhook[] }) {
    const [state, action, pending] = useActionState(createWebhook, initialState);
    const [showForm, setShowForm] = useState(false);

    return (
        <div className="space-y-4">
            {showForm ? (
                <form action={action} className="space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
                    <input type="hidden" name="projectId" value={projectId} />
                    <div className="space-y-1.5">
                        <Label htmlFor="url">Endpoint URL</Label>
                        <Input id="url" name="url" type="url" placeholder="https://game.example.com/hook" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Events to subscribe</Label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {WEBHOOK_EVENTS.map((event) => (
                                <label
                                    key={event}
                                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/50"
                                >
                                    <input
                                        type="checkbox"
                                        name="events"
                                        value={event}
                                        className="size-3.5 rounded border-border accent-foreground"
                                    />
                                    <span className="font-mono text-xs text-foreground/90">{event}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
                    <div className="flex items-center gap-2 pt-1">
                        <Button type="submit" size="sm" disabled={pending}>
                            {pending ? "Adding…" : "Add endpoint"}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowForm(false)}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <div className="flex justify-start">
                    <Button type="button" size="sm" onClick={() => setShowForm(true)}>
                        <Plus className="size-4" />
                        Add endpoint
                    </Button>
                </div>
            )}

            {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhook endpoints registered.</p>
            ) : (
                <ul className="divide-y divide-border/60">
                    {webhooks.map((webhook) => (
                        <li
                            key={webhook.id}
                            className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0 space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="truncate font-mono text-xs font-medium text-foreground">
                                        {webhook.url}
                                    </span>
                                    <CopyButton value={webhook.url} label="Copy endpoint URL" />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {webhook.events.map((ev) => (
                                        <Badge
                                            key={ev}
                                            variant="secondary"
                                            className="px-1.5 py-0 font-mono text-[10px]"
                                        >
                                            {ev}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                <StatusBadge status={webhook.isActive ? "active" : "inactive"} />
                                <form action={setWebhookActive}>
                                    <input type="hidden" name="projectId" value={projectId} />
                                    <input type="hidden" name="webhookId" value={webhook.id} />
                                    <input type="hidden" name="isActive" value={webhook.isActive ? "false" : "true"} />
                                    <Button type="submit" variant="ghost" size="sm">
                                        {webhook.isActive ? "Disable" : "Enable"}
                                    </Button>
                                </form>
                                <form action={deleteWebhook}>
                                    <input type="hidden" name="projectId" value={projectId} />
                                    <input type="hidden" name="webhookId" value={webhook.id} />
                                    <ConfirmButton confirmLabel="Delete webhook">Delete</ConfirmButton>
                                </form>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
