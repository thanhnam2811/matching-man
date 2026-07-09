import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApiError, apiFetch, type Project } from "@/lib/api";
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
            <div className="space-y-1">
                <Link
                    href={`/dashboard/organizations/${project.organization.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-3" />
                    {project.organization.name}
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <p className="font-mono text-xs text-muted-foreground">{project.id}</p>
            </div>

            <ProjectNav projectId={projectId} />

            {children}
        </div>
    );
}
