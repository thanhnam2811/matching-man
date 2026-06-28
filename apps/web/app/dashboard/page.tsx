import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { apiFetch, type OrganizationSummary } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrganizationForm } from "@/components/create-organization-form";

export default async function DashboardHome() {
    const organizations = await apiFetch<OrganizationSummary[]>("/organizations");

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
                <p className="text-sm text-muted-foreground">Your tenants. Open one to manage its projects.</p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <CreateOrganizationForm />
                </CardContent>
            </Card>

            {organizations.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No organizations yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {organizations.map((organization) => (
                        <Link
                            key={organization.id}
                            href={`/dashboard/organizations/${organization.id}`}
                            className="group"
                        >
                            <Card className="transition-colors group-hover:border-foreground/20">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>{organization.name}</CardTitle>
                                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                    </div>
                                    <CardDescription className="font-mono text-xs">{organization.slug}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex gap-4 text-xs text-muted-foreground">
                                    <span>{organization.projectCount} projects</span>
                                    <span>{organization.memberCount} members</span>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
