import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { apiFetch, type Project } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export default async function DashboardHome() {
    const projects = await apiFetch<Project[]>("/projects");

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
                <p className="text-sm text-muted-foreground">Select a project to inspect its live operations.</p>
            </div>

            {projects.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        No projects yet.
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {projects.map((project) => (
                        <Link key={project.id} href={`/projects/${project.id}`} className="group">
                            <Card className="transition-colors group-hover:border-foreground/20">
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
    );
}