import { apiFetch, type ApiKey, type Environment, type Webhook } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { EnvironmentsManager } from "@/components/environments-manager";
import { WebhooksManager } from "@/components/webhooks-manager";

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
                <CardContent>
                    <EnvironmentsManager projectId={projectId} environments={environments} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>API keys</CardTitle>
                    <CardDescription>{apiKeys.length} issued</CardDescription>
                </CardHeader>
                <CardContent>
                    <ApiKeysManager projectId={projectId} apiKeys={apiKeys} />
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>{webhooks.length} endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                    <WebhooksManager projectId={projectId} webhooks={webhooks} />
                </CardContent>
            </Card>
        </div>
    );
}