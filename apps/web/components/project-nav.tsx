"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ProjectNav({ projectId }: { projectId: string }) {
    const pathname = usePathname();
    const base = `/dashboard/projects/${projectId}`;

    const items = [
        { href: base, label: "Overview" },
        { href: `${base}/pools`, label: "Pools" },
        { href: `${base}/matches`, label: "Matches" },
        { href: `${base}/deliveries`, label: "Deliveries" },
        { href: `${base}/ratings`, label: "Ratings" },
    ];

    return (
        <nav className="flex gap-1 border-b">
            {items.map((item) => {
                const active = item.href === base ? pathname === base : pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
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
