"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared sidebar/drawer navigation link with the brand-tinted active state.
export function NavLink({
    href,
    active,
    icon: Icon,
    onNavigate,
    children,
}: {
    href: string;
    active?: boolean;
    icon?: LucideIcon;
    onNavigate?: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
        >
            {Icon ? <Icon /> : <span className="size-4" aria-hidden />}
            {children}
        </Link>
    );
}
