import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { ApiError, apiFetch, type ApiKey, type Environment } from "@/lib/api";
import { ApiKeysManager } from "@/components/api-keys-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EnvironmentsManager } from "@/components/environments-manager";

export default async function ProjectApiKeysPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    let environments: Environment[];
    let apiKeys: ApiKey[];
    try {
        [environments, apiKeys] = await Promise.all([
            apiFetch<Environment[]>(`/projects/${projectId}/environments`),
            apiFetch<ApiKey[]>(`/projects/${projectId}/api-keys`),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        if (error instanceof ApiError && error.status === 403) {
            return (
                <Card>
                    <CardContent className="p-0">
                        <EmptyState
                            icon={Lock}
                            title="You don't have access to this project"
                            description="Ask a project or organization admin to grant you access."
                            action={{ label: "Back to dashboard", href: "/dashboard" }}
                        />
                    </CardContent>
                </Card>
            );
        }
        throw error;
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Environments</CardTitle>
                    <CardDescription>{environments.length} configured</CardDescription>
                </CardHeader>
                <CardContent>
                    <EnvironmentsManager projectId={projectId} environments={environments} />
                </CardContent>
            </Card>

            <Card className="min-w-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1.5">
                        <CardTitle>API keys</CardTitle>
                        <CardDescription>{apiKeys.length} issued</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href={`/dashboard/projects/${projectId}/api-keys/new`}>
                            <Plus className="size-4 mr-1.5" />
                            New API key
                        </Link>
                    </Button>
                </CardHeader>
                <CardContent>
                    <ApiKeysManager projectId={projectId} apiKeys={apiKeys} />
                </CardContent>
            </Card>
        </div>
    );
}
