import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: { label: string; href: string };
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col items-center gap-2 py-12 text-center", className)}>
            {Icon ? (
                <div className="mb-1 flex size-9 items-center justify-center rounded-md border bg-card">
                    <Icon className="size-4 text-muted-foreground" />
                </div>
            ) : null}
            <p className="text-sm font-medium">{title}</p>
            {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
            {action ? (
                <Link href={action.href} className="mt-2 inline-block">
                    <Button variant="outline" size="sm">
                        {action.label}
                    </Button>
                </Link>
            ) : null}
        </div>
    );
}
