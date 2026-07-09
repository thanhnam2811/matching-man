"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function projectNavItems(projectId: string) {
    const base = `/dashboard/projects/${projectId}`;
    return [
        { href: base, label: "Overview" },
        { href: `${base}/pools`, label: "Pools" },
        { href: `${base}/matches`, label: "Matches" },
        { href: `${base}/deliveries`, label: "Deliveries" },
        { href: `${base}/ratings`, label: "Ratings" },
    ];
}

// The Overview link is only active on an exact match; the others match their subtree.
export function isProjectNavActive(href: string, base: string, pathname: string) {
    return href === base ? pathname === base : pathname.startsWith(href);
}

export function ProjectNav({ projectId }: { projectId: string }) {
    const pathname = usePathname();
    const base = `/dashboard/projects/${projectId}`;
    const items = projectNavItems(projectId);

    return (
        <nav className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
                const active = isProjectNavActive(item.href, base, pathname);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                            active
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
