"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, Play } from "lucide-react";
import type { OrganizationMembership } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { NavLink } from "@/components/nav-link";
import { OrgSwitcher } from "@/components/org-switcher";
import { isProjectNavActive, projectNavItems } from "@/components/project-nav";

// Desktop (lg+) sidebar: brand, tenant switcher, and contextual navigation.
// Below lg the drawer in DashboardMobileNav carries the same links.
export function DashboardSidebar({ organizations }: { organizations: OrganizationMembership[] }) {
    const pathname = usePathname();
    const projectId = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1];
    const projectBase = projectId ? `/dashboard/projects/${projectId}` : "";
    const orgsActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/organizations");

    return (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card/40 lg:flex">
            <div className="flex h-14 shrink-0 items-center border-b px-4">
                <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                    <BrandMark />
                    Matching Hub
                </Link>
            </div>

            <div className="shrink-0 border-b p-3">
                <OrgSwitcher organizations={organizations} />
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
                <NavLink href="/dashboard" active={orgsActive} icon={Building2}>
                    Organizations
                </NavLink>

                {projectId ? (
                    <div className="pt-4">
                        <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Project
                        </p>
                        <div className="space-y-0.5">
                            {projectNavItems(projectId).map((item) => (
                                <NavLink
                                    key={item.href}
                                    href={item.href}
                                    active={isProjectNavActive(item.href, projectBase, pathname)}
                                    icon={item.icon}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ) : null}
            </nav>

            <div className="shrink-0 space-y-0.5 border-t p-3">
                <NavLink href="/demo" icon={Play}>
                    Live demo
                </NavLink>
                <NavLink href="/" icon={Home}>
                    Home
                </NavLink>
            </div>
        </aside>
    );
}
