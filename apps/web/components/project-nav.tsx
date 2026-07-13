"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, Layers, LayoutDashboard, Swords, TrendingUp, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

export function projectNavItems(projectId: string): { href: string; label: string; icon: LucideIcon }[] {
    const base = `/dashboard/projects/${projectId}`;
    return [
        { href: base, label: "Overview", icon: LayoutDashboard },
        { href: `${base}/pools`, label: "Pools", icon: Layers },
        { href: `${base}/matches`, label: "Matches", icon: Swords },
        { href: `${base}/deliveries`, label: "Deliveries", icon: Webhook },
        { href: `${base}/ratings`, label: "Ratings", icon: TrendingUp },
    ];
}

// The Overview link is only active on an exact match; the others match their subtree.
export function isProjectNavActive(href: string, base: string, pathname: string) {
    return href === base ? pathname === base : pathname.startsWith(href);
}

// Horizontal tab nav for the project subpages. Only rendered below `lg` — on
// desktop the sidebar carries the same links.
export function ProjectNav({ projectId }: { projectId: string }) {
    const pathname = usePathname();
    const base = `/dashboard/projects/${projectId}`;
    const items = projectNavItems(projectId);

    return (
        <nav className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
            {items.map((item) => {
                const active = isProjectNavActive(item.href, base, pathname);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        className={cn(
                            "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                            active
                                ? "border-primary text-foreground"
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
