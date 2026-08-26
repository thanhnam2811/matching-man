import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateApiKeyForm } from "@/components/create-api-key-form";

export default async function NewApiKeyPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>Generate API key</CardTitle>
                <CardDescription>
                    Create a secret token for authenticating game servers and background workers against this project.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <CreateApiKeyForm projectId={projectId} />
            </CardContent>
        </Card>
    );
}
