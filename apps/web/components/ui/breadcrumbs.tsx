import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = { label: string; href?: string };

// Server-friendly breadcrumb trail. The last item (no href) is the current page.
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
    return (
        <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
            {items.map((item, index) => (
                <React.Fragment key={`${item.label}-${index}`}>
                    {index > 0 ? <ChevronRight className="size-3 shrink-0" /> : null}
                    {item.href ? (
                        <Link href={item.href} className="max-w-40 truncate transition-colors hover:text-foreground">
                            {item.label}
                        </Link>
                    ) : (
                        <span aria-current="page" className="max-w-48 truncate font-medium text-foreground">
                            {item.label}
                        </span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}
