"use client";

import { Webhook as WebhookIcon } from "lucide-react";
import { deleteWebhook, setWebhookActive } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status-badge";

type Webhook = {
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
};

export function WebhooksManager({ projectId, webhooks }: { projectId: string; webhooks: Webhook[] }) {
    if (webhooks.length === 0) {
        return (
            <EmptyState
                icon={WebhookIcon}
                title="No webhook endpoints registered"
                description="Add an endpoint URL to receive events for match results, queue timeouts, and penalty updates."
                action={{
                    label: "New webhook",
                    href: `/dashboard/projects/${projectId}/webhooks/new`,
                }}
            />
        );
    }

    return (
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
                                <Badge key={ev} variant="secondary" className="px-1.5 py-0 font-mono text-[10px]">
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
    );
}
