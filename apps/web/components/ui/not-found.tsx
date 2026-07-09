import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundView({
    title = "Not found",
    description = "The page you're looking for doesn't exist or you don't have access to it.",
    backHref = "/",
    backLabel = "Go back",
}: {
    title?: string;
    description?: string;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border bg-card">
                <SearchX className="size-5 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
            <Link href={backHref} className="mt-2 inline-block">
                <Button variant="outline" size="sm">
                    {backLabel}
                </Button>
            </Link>
        </div>
    );
}
