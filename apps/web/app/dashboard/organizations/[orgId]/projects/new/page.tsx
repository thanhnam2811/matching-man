import { notFound } from "next/navigation";
import { ApiError, apiFetch, type OrganizationDetail } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/create-project-form";

export default async function NewProjectPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = await params;

    let organization: OrganizationDetail;
    try {
        organization = await apiFetch<OrganizationDetail>(`/organizations/${orgId}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        throw error;
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-1.5">
                <Breadcrumbs
                    items={[
                        { label: "Organizations", href: "/dashboard" },
                        { label: organization.name, href: `/dashboard/organizations/${orgId}` },
                        { label: "New project" },
                    ]}
                />
                <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
                <p className="text-sm text-muted-foreground">
                    Create a new project in <span className="font-medium text-foreground">{organization.name}</span>.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Project details</CardTitle>
                    <CardDescription>Projects belong to this organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CreateProjectForm organizationId={orgId} cancelHref={`/dashboard/organizations/${orgId}`} />
                </CardContent>
            </Card>
        </div>
    );
}
