import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiFetch, type Project } from "@/lib/api";
import { ProjectNav } from "@/components/project-nav";

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = await params;
    const project = await apiFetch<Project>(`/projects/${projectId}`);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-1">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-3" />
                    All projects
                </Link>
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <p className="font-mono text-xs text-muted-foreground">{project.id}</p>
            </div>

            <ProjectNav projectId={projectId} />

            {children}
        </div>
    );
}