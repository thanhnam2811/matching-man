"use client";

import { useActionState } from "react";
import { type ApiKeyState, createApiKey, revokeApiKey } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { CopyButton } from "@/components/ui/copy-button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiKey = {
    id: string;
    name: string;
    keyPrefix: string;
    lastFour: string;
    isRevoked: boolean;
};

const initialState: ApiKeyState = {};

export function ApiKeysManager({ projectId, apiKeys }: { projectId: string; apiKeys: ApiKey[] }) {
    const [state, action, pending] = useActionState(createApiKey, initialState);

    return (
        <div className="space-y-4">
            <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <input type="hidden" name="projectId" value={projectId} />
                <Input name="name" placeholder="Key name (optional)" className="flex-1" />
                <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "New key"}
                </Button>
            </form>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            {state.key ? (
                <div className="rounded-md border border-success/40 bg-success/10 p-3">
                    <p className="text-xs text-muted-foreground">Copy this key now — it will not be shown again.</p>
                    <div className="mt-1 flex items-start gap-2">
                        <code className="block flex-1 break-all font-mono text-sm">{state.key}</code>
                        <CopyButton value={state.key} label="Copy API key" />
                    </div>
                </div>
            ) : null}

            {apiKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API keys.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {apiKeys.map((apiKey) => (
                            <TableRow key={apiKey.id}>
                                <TableCell>{apiKey.name}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    {apiKey.keyPrefix}…{apiKey.lastFour}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={apiKey.isRevoked ? "destructive" : "success"}>
                                        {apiKey.isRevoked ? "revoked" : "active"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {apiKey.isRevoked ? null : (
                                        <form action={revokeApiKey} className="inline">
                                            <input type="hidden" name="projectId" value={projectId} />
                                            <input type="hidden" name="apiKeyId" value={apiKey.id} />
                                            <ConfirmButton confirmLabel="Revoke key">Revoke</ConfirmButton>
                                        </form>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
