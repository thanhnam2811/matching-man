import { notFound } from "next/navigation";
import { apiFetch, getProjectAuditLogs, type ProjectDetail } from "@/lib/api";
import { AuditLogsTable } from "@/components/audit-logs-table";

export const metadata = {
    title: "Audit Logs - Matching Man",
};

export default async function ProjectAuditLogsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    let project: ProjectDetail;
    let auditLogsResponse;

    try {
        [project, auditLogsResponse] = await Promise.all([
            apiFetch<ProjectDetail>(`/projects/${projectId}`),
            getProjectAuditLogs(projectId, { limit: 100 }),
        ]);
    } catch {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Audit Logs</h1>
                    <p className="text-sm text-muted-foreground">
                        Trace administrative events, entity mutations, and security actions within {project.name}.
                    </p>
                </div>
            </div>

            <AuditLogsTable logs={auditLogsResponse?.items || []} projectId={projectId} />
        </div>
    );
}
