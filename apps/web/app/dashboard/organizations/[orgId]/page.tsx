import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ChevronRight, CreditCard, Plus } from "lucide-react";
import { ApiError, apiFetch, getCurrentUser, type OrganizationDetail, type OrganizationMember } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MembersManager } from "@/components/members-manager";
import { formatDateTime } from "@/lib/utils";

export default async function OrganizationPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = await params;

    let organization: OrganizationDetail;
    let members: OrganizationMember[];
    let me: Awaited<ReturnType<typeof getCurrentUser>>;
    try {
        [organization, members, me] = await Promise.all([
            apiFetch<OrganizationDetail>(`/organizations/${orgId}`),
            apiFetch<OrganizationMember[]>(`/organizations/${orgId}/members`),
            getCurrentUser(),
        ]);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        throw error;
    }

    const myRole = me.organizations.find((membership) => membership.id === orgId)?.role;
    const canManage = myRole === "OWNER" || myRole === "ADMIN";

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                    <Breadcrumbs
                        items={[{ label: "Organizations", href: "/dashboard" }, { label: organization.name }]}
                    />
                    <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
                    <p className="font-mono text-xs text-muted-foreground">{organization.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/dashboard/organizations/${orgId}/billing`}>
                            <CreditCard className="size-4 mr-1.5" />
                            Billing & Plans
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/dashboard/organizations/${orgId}/projects/new`}>
                            <Plus className="size-4 mr-1.5" />
                            New project
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
                {organization.projects.length === 0 ? (
                    <Card>
                        <CardContent className="p-0">
                            <EmptyState
                                icon={Boxes}
                                title="No projects yet"
                                description="Create a project to configure environments, keys, and webhooks."
                                action={{
                                    label: "Create project",
                                    href: `/dashboard/organizations/${orgId}/projects/new`,
                                }}
                            />
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {organization.projects.map((project) => (
                            <Link key={project.id} href={`/dashboard/projects/${project.id}`} className="group">
                                <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>{project.name}</CardTitle>
                                            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                        </div>
                                        <CardDescription className="font-mono text-xs">{project.slug}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex justify-between text-xs text-muted-foreground">
                                        <span>{project.defaultRegion ?? "no default region"}</span>
                                        <span>{formatDateTime(project.createdAt)}</span>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Members</CardTitle>
                    <CardDescription>{members.length} in this organization</CardDescription>
                </CardHeader>
                <CardContent>
                    <MembersManager
                        scope="organizations"
                        scopeId={organization.id}
                        members={members}
                        canManage={canManage}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
