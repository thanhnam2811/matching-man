"use client";

import { KeyRound } from "lucide-react";
import { revokeApiKey } from "@/lib/actions";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiKey = {
    id: string;
    name: string;
    keyPrefix: string;
    lastFour: string;
    isRevoked: boolean;
};

export function ApiKeysManager({ projectId, apiKeys }: { projectId: string; apiKeys: ApiKey[] }) {
    if (apiKeys.length === 0) {
        return (
            <EmptyState
                icon={KeyRound}
                title="No API keys issued"
                description="Generate an API key to authenticate game servers and background workers."
                action={{
                    label: "New API key",
                    href: `/dashboard/projects/${projectId}/api-keys/new`,
                }}
            />
        );
    }

    return (
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
                        <TableCell className="font-medium">{apiKey.name || "Untitled key"}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                            {apiKey.keyPrefix}…{apiKey.lastFour}
                        </TableCell>
                        <TableCell>
                            <StatusBadge status={apiKey.isRevoked ? "revoked" : "active"} />
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
    );
}
