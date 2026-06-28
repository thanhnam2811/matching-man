import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
    basePath,
    offset,
    limit,
    total,
}: {
    basePath: string;
    offset: number;
    limit: number;
    total: number;
}) {
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + limit, total);
    const hasPrev = offset > 0;
    const hasNext = offset + limit < total;

    const prevHref = `${basePath}?offset=${Math.max(offset - limit, 0)}`;
    const nextHref = `${basePath}?offset=${offset + limit}`;
    const disabled = "pointer-events-none opacity-50";

    return (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
                {from}–{to} of {total}
            </span>
            <div className="flex gap-2">
                <Link
                    href={prevHref}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasPrev && disabled)}
                    aria-disabled={!hasPrev}
                >
                    <ChevronLeft className="size-4" />
                    Prev
                </Link>
                <Link
                    href={nextHref}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), !hasNext && disabled)}
                    aria-disabled={!hasNext}
                >
                    Next
                    <ChevronRight className="size-4" />
                </Link>
            </div>
        </div>
    );
}
