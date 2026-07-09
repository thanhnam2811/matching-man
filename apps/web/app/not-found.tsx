import { NotFoundView } from "@/components/ui/not-found";

export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center">
            <NotFoundView
                title="Page not found"
                description="The page you're looking for doesn't exist or may have moved."
                backHref="/"
                backLabel="Back to home"
            />
        </main>
    );
}
