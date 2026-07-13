import { notFound } from "next/navigation";
import { ApiError, apiFetch, type Project } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CopyButton } from "@/components/ui/copy-button";
import { ProjectNav } from "@/components/project-nav";

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;

    let project: Project & { organization: { id: string; name: string } };
    try {
        project = await apiFetch<Project & { organization: { id: string; name: string } }>(`/projects/${projectId}`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            notFound();
        }
        throw error;
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-1.5">
                <Breadcrumbs
                    items={[
                        { label: "Organizations", href: "/dashboard" },
                        {
                            label: project.organization.name,
                            href: `/dashboard/organizations/${project.organization.id}`,
                        },
                        { label: project.name },
                    ]}
                />
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <span className="inline-flex items-center gap-1">
                    <span className="font-mono text-xs text-muted-foreground">{project.id}</span>
                    <CopyButton value={project.id} label="Copy project ID" />
                </span>
            </div>

            <ProjectNav projectId={projectId} />

            {children}
        </div>
    );
}
