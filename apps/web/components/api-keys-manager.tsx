"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
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
                <Button type="submit" loading={pending}>
                    {pending ? "Creating…" : "New key"}
                </Button>
            </form>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            {state.key ? (
                <div className="space-y-2 rounded-md border border-success/40 bg-success/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <KeyRound className="size-4 text-success" />
                        New API key
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Copy it now — for security it won&apos;t be shown again.
                    </p>
                    <div className="flex items-center gap-2 rounded border bg-background px-2 py-1.5">
                        <code className="flex-1 break-all font-mono text-xs">{state.key}</code>
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
