import { apiFetch, type ApiKey, type Environment, type Webhook } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export default async function ProjectOverview({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    const [environments, apiKeys, webhooks] = await Promise.all([
        apiFetch<Environment[]>(`/projects/${projectId}/environments`),
        apiFetch<ApiKey[]>(`/projects/${projectId}/api-keys`),
        apiFetch<Webhook[]>(`/projects/${projectId}/webhooks`),
    ]);

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Environments</CardTitle>
                    <CardDescription>{environments.length} configured</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    {environments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No environments.</p>
                    ) : (
                        environments.map((environment) => (
                            <Badge key={environment.id} variant={environment.isDefault ? "default" : "secondary"}>
                                {environment.name}
                                {environment.isDefault ? " · default" : ""}
                            </Badge>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>API keys</CardTitle>
                    <CardDescription>{apiKeys.length} issued</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {apiKeys.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">No API keys.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Key</TableHead>
                                    <TableHead>Status</TableHead>
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
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>{webhooks.length} endpoints</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {webhooks.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground">No webhook endpoints.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>URL</TableHead>
                                    <TableHead>Events</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {webhooks.map((webhook) => (
                                    <TableRow key={webhook.id}>
                                        <TableCell className="font-mono text-xs">{webhook.url}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {webhook.events.join(", ")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={webhook.isActive ? "success" : "secondary"}>
                                                {webhook.isActive ? "active" : "inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(webhook.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}