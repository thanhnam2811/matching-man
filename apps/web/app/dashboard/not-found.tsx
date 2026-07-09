import { NotFoundView } from "@/components/ui/not-found";

export default function DashboardNotFound() {
    return (
        <div className="mx-auto max-w-5xl">
            <NotFoundView
                title="Page not found"
                description="That dashboard page doesn't exist."
                backHref="/dashboard"
                backLabel="Back to dashboard"
            />
        </div>
    );
}
