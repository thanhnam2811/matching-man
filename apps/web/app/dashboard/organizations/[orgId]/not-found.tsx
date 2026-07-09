import { NotFoundView } from "@/components/ui/not-found";

export default function OrganizationNotFound() {
    return (
        <div className="mx-auto max-w-5xl">
            <NotFoundView
                title="Organization not found"
                description="It may have been deleted, or you may no longer have access to it."
                backHref="/dashboard"
                backLabel="Back to organizations"
            />
        </div>
    );
}
