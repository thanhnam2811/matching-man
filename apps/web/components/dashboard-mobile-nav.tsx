"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Building2, Home, Menu as MenuIcon, Play, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Drawer } from "@/components/ui/drawer";
import { NavLink } from "@/components/nav-link";
import { isProjectNavActive, projectNavItems } from "@/components/project-nav";

export function DashboardMobileNav() {
    const [open, setOpen] = React.useState(false);
    const pathname = usePathname();
    const close = React.useCallback(() => setOpen(false), []);

    // Close whenever the route changes (covers navigations to a different path).
    React.useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const projectId = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1];
    const projectBase = projectId ? `/dashboard/projects/${projectId}` : "";
    const orgsActive = pathname === "/dashboard" || pathname.startsWith("/dashboard/organizations");

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
            >
                <MenuIcon className="size-5" />
            </button>

            <Drawer open={open} onClose={close} label="Navigation">
                <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                    <span className="flex items-center gap-2 font-semibold">
                        <BrandMark />
                        Matching Hub
                    </span>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close navigation"
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-3">
                    <NavLink href="/dashboard" active={orgsActive} icon={Building2} onNavigate={close}>
                        Organizations
                    </NavLink>

                    {projectId ? (
                        <div className="mt-4 space-y-0.5">
                            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Project
                            </p>
                            {projectNavItems(projectId).map((item) => (
                                <NavLink
                                    key={item.href}
                                    href={item.href}
                                    active={isProjectNavActive(item.href, projectBase, pathname)}
                                    icon={item.icon}
                                    onNavigate={close}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ) : null}
                </nav>

                <div className="shrink-0 space-y-0.5 border-t p-3">
                    <NavLink href="/demo" icon={Play} onNavigate={close}>
                        Live demo
                    </NavLink>
                    <NavLink href="/" icon={Home} onNavigate={close}>
                        Home
                    </NavLink>
                </div>
            </Drawer>
        </>
    );
}
