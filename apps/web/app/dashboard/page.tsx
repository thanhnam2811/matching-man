import Link from "next/link";
import { Building2, ChevronRight, Plus } from "lucide-react";
import { apiFetch, type OrganizationSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function DashboardHome() {
    const organizations = await apiFetch<OrganizationSummary[]>("/organizations");

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
                    <p className="text-sm text-muted-foreground">Your tenants. Open one to manage its projects.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/organizations/new">
                        <Plus className="size-4 mr-1.5" />
                        New organization
                    </Link>
                </Button>
            </div>

            {organizations.length === 0 ? (
                <Card>
                    <CardContent className="p-0">
                        <EmptyState
                            icon={Building2}
                            title="No organizations yet"
                            description="Create your first organization to start adding projects."
                            action={{ label: "Create organization", href: "/dashboard/organizations/new" }}
                        />
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
                            <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
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
