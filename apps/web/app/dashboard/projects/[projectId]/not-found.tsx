import { NotFoundView } from "@/components/ui/not-found";

export default function ProjectNotFound() {
    return (
        <div className="mx-auto max-w-6xl">
            <NotFoundView
                title="Project not found"
                description="It may have been deleted, or you may no longer have access to it."
                backHref="/dashboard"
                backLabel="Back to organization"
            />
        </div>
    );
}
