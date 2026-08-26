import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateWebhookForm } from "@/components/create-webhook-form";

export default async function NewWebhookPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>New webhook</CardTitle>
                <CardDescription>
                    Register an HTTP endpoint to receive event notifications for matches, queues, and penalties.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <CreateWebhookForm projectId={projectId} />
            </CardContent>
        </Card>
    );
}
