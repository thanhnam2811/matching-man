"use client";

import { useActionState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { type ApiKeyState, createApiKey } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ApiKeyState = {};

export function CreateApiKeyForm({ projectId }: { projectId: string }) {
    const [state, action, pending] = useActionState(createApiKey, initialState);

    if (state.key) {
        return (
            <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-success/40 bg-success/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <KeyRound className="size-4 text-success" />
                        API Key Generated Successfully
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Copy it now — for security it won&apos;t be shown again.
                    </p>
                    <div className="flex items-center gap-2 rounded border bg-background px-3 py-2">
                        <code className="flex-1 break-all font-mono text-xs font-medium text-foreground">
                            {state.key}
                        </code>
                        <CopyButton value={state.key} label="Copy API key" />
                    </div>
                </div>

                <div className="flex justify-start">
                    <Button asChild>
                        <Link href={`/dashboard/projects/${projectId}/api-keys`}>Done</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />

            <div className="space-y-2">
                <Label htmlFor="name">Key Name (optional)</Label>
                <Input id="name" name="name" placeholder="e.g. Production Game Server, CI/CD" disabled={pending} />
                <p className="text-xs text-muted-foreground">
                    A friendly label to help you identify which service or environment uses this key.
                </p>
            </div>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Generating…" : "Generate key"}
                </Button>
                <Button asChild variant="ghost" disabled={pending}>
                    <Link href={`/dashboard/projects/${projectId}/api-keys`}>Cancel</Link>
                </Button>
            </div>
        </form>
    );
}
