"use client";

import { useActionState } from "react";
import { createWebhook, deleteWebhook, type FormState, setWebhookActive } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Webhook = {
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
};

const WEBHOOK_EVENTS = ["match.created", "match.completed", "match.failed", "queue.timeout", "rating.updated"];

const initialState: FormState = {};

export function WebhooksManager({ projectId, webhooks }: { projectId: string; webhooks: Webhook[] }) {
    const [state, action, pending] = useActionState(createWebhook, initialState);

    return (
        <div className="space-y-4">
            <form action={action} className="space-y-3">
                <input type="hidden" name="projectId" value={projectId} />
                <div className="space-y-2">
                    <Label htmlFor="url">Endpoint URL</Label>
                    <Input id="url" name="url" type="url" placeholder="https://game.example.com/hook" required />
                </div>
                <div className="space-y-2">
                    <Label>Events</Label>
                    <div className="flex flex-wrap gap-3">
                        {WEBHOOK_EVENTS.map((event) => (
                            <label key={event} className="flex items-center gap-1.5 text-sm">
                                <input type="checkbox" name="events" value={event} className="accent-foreground" />
                                <span className="font-mono text-xs">{event}</span>
                            </label>
                        ))}
                    </div>
                </div>
                {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
                <Button type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Add webhook"}
                </Button>
            </form>

            {webhooks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No webhook endpoints.</p>
            ) : (
                <ul className="divide-y">
                    {webhooks.map((webhook) => (
                        <li key={webhook.id} className="flex items-center justify-between gap-3 py-3">
                            <div className="min-w-0">
                                <p className="truncate font-mono text-xs">{webhook.url}</p>
                                <p className="truncate text-xs text-muted-foreground">{webhook.events.join(", ")}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Badge variant={webhook.isActive ? "success" : "secondary"}>
                                    {webhook.isActive ? "active" : "inactive"}
                                </Badge>
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
                                    <Button type="submit" variant="ghost" size="sm">
                                        Delete
                                    </Button>
                                </form>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}