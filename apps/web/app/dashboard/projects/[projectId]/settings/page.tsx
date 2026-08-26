import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { ApiError, apiFetch, getCurrentUser, type OrganizationMember, type ProjectDetail } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MembersManager } from "@/components/members-manager";
import { PenaltySettingsCard } from "@/components/penalties/penalty-settings-card";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    let project: ProjectDetail;
    let me: Awaited<ReturnType<typeof getCurrentUser>>;
    let orgMembers: OrganizationMember[];
    try {
        [project, me] = await Promise.all([apiFetch<ProjectDetail>(`/projects/${projectId}`), getCurrentUser()]);
        orgMembers = await apiFetch<OrganizationMember[]>(`/organizations/${project.organization.id}/members`);
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

    const orgRole = me.organizations.find((organization) => organization.id === project.organization.id)?.role;
    const myProjectRole = project.members.find((member) => member.user.id === me.id)?.role;
    const canManageMembers =
        orgRole === "OWNER" || orgRole === "ADMIN" || myProjectRole === "OWNER" || myProjectRole === "ADMIN";

    return (
        <div className="space-y-6">
            <PenaltySettingsCard
                projectId={projectId}
                enableDodgePenalty={project.enableDodgePenalty}
                penaltyTiers={project.penaltyTiers}
                penaltyDecayHours={project.penaltyDecayHours}
                canManage={canManageMembers}
            />

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>{project.members.length} in this project</CardDescription>
                </CardHeader>
                <CardContent>
                    <MembersManager
                        scope="projects"
                        scopeId={project.id}
                        members={project.members}
                        canManage={canManageMembers}
                        orgMembers={orgMembers}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
