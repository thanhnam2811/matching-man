import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ChevronRight } from "lucide-react";
import { ApiError, apiFetch, getCurrentUser, type OrganizationDetail, type OrganizationMember } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateProjectForm } from "@/components/create-project-form";
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
            <div className="space-y-1.5">
                <Breadcrumbs items={[{ label: "Organizations", href: "/dashboard" }, { label: organization.name }]} />
                <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
                <p className="font-mono text-xs text-muted-foreground">{organization.slug}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">New project</CardTitle>
                    <CardDescription>Projects belong to this organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CreateProjectForm organizationId={organization.id} />
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
                {organization.projects.length === 0 ? (
                    <Card>
                        <CardContent className="p-0">
                            <EmptyState
                                icon={Boxes}
                                title="No projects yet"
                                description="Create a project above to configure environments, keys, and webhooks."
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
                    <MembersManager organizationId={organization.id} members={members} canManage={canManage} />
                </CardContent>
            </Card>
        </div>
    );
}
