import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Plus } from "lucide-react";
import { ApiError, apiFetch, type Webhook } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { WebhooksManager } from "@/components/webhooks-manager";

export default async function ProjectWebhooksPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    let webhooks: Webhook[];
    try {
        webhooks = await apiFetch<Webhook[]>(`/projects/${projectId}/webhooks`);
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
        <Card className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="space-y-1.5">
                    <CardTitle>Webhooks</CardTitle>
                    <CardDescription>{webhooks.length} endpoints</CardDescription>
                </div>
                <Button asChild size="sm">
                    <Link href={`/dashboard/projects/${projectId}/webhooks/new`}>
                        <Plus className="size-4 mr-1.5" />
                        New webhook
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                <WebhooksManager projectId={projectId} webhooks={webhooks} />
            </CardContent>
        </Card>
    );
}
