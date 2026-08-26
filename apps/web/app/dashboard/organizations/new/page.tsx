import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/components/create-organization-form";

export default function NewOrganizationPage() {
    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="space-y-1.5">
                <Breadcrumbs items={[{ label: "Organizations", href: "/dashboard" }, { label: "New organization" }]} />
                <h1 className="text-2xl font-semibold tracking-tight">New organization</h1>
                <p className="text-sm text-muted-foreground">
                    Create a new organization tenant to manage projects and team members.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Organization details</CardTitle>
                    <CardDescription>Enter a name for your organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CreateOrganizationForm cancelHref="/dashboard" />
                </CardContent>
            </Card>
        </div>
    );
}
