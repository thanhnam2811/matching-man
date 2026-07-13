"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { Command } from "cmdk";
import { Building2, Boxes, Home, LogOut, Moon, Play, Search, Sun } from "lucide-react";
import type { NavOrganization } from "@/lib/api";
import { isProjectNavActive, projectNavItems } from "@/components/project-nav";
import { cn } from "@/lib/utils";

// Global ⌘K / Ctrl+K command palette: fuzzy-jump to any organization, project,
// or tab, plus quick actions. The nav index is fetched lazily on first open.
export function CommandPalette() {
    const [open, setOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const router = useRouter();
    const pathname = usePathname();

    React.useEffect(() => setMounted(true), []);

    // Only hit /api/nav once the palette has been opened.
    const { data: organizations } = useSWR<NavOrganization[]>(open ? "/api/nav" : null, {
        revalidateOnFocus: false,
    });

    React.useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen((value) => !value);
            }
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    const close = React.useCallback(() => setOpen(false), []);

    function go(href: string) {
        close();
        router.push(href);
    }

    function toggleTheme() {
        close();
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            // ignore storage failures (private mode etc.)
        }
    }

    async function signOut() {
        close();
        await fetch("/api/session", { method: "DELETE" });
        router.replace("/login");
        router.refresh();
    }

    const projectId = pathname.match(/^\/dashboard\/projects\/([^/]+)/)?.[1];
    const projectBase = projectId ? `/dashboard/projects/${projectId}` : "";
    const currentProject = organizations?.flatMap((org) => org.projects).find((project) => project.id === projectId);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open command palette"
                className="hidden h-8 w-44 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:flex lg:w-56"
            >
                <Search className="size-3.5 shrink-0" />
                <span className="flex-1 text-left text-xs">Search…</span>
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open command palette"
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
            >
                <Search className="size-4" />
            </button>

            {mounted && open
                ? createPortal(
                      <div className="fixed inset-0 z-50">
                          <div className="absolute inset-0 bg-black/60" onClick={close} />
                          <div className="absolute left-1/2 top-20 w-full max-w-lg -translate-x-1/2 px-4">
                              <Command
                                  loop
                                  label="Command palette"
                                  className="animate-fade-in overflow-hidden rounded-lg border bg-card text-card-foreground shadow-2xl"
                              >
                                  <div className="flex items-center gap-2 border-b px-3">
                                      <Search className="size-4 shrink-0 text-muted-foreground" />
                                      <Command.Input
                                          autoFocus
                                          placeholder="Search organizations, projects, pages…"
                                          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                      />
                                  </div>
                                  <Command.List className="max-h-80 overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                                      <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                                          No results.
                                      </Command.Empty>

                                      {projectId ? (
                                          <Command.Group heading={currentProject?.name ?? "Current project"}>
                                              {projectNavItems(projectId).map((item) => (
                                                  <PaletteItem
                                                      key={item.href}
                                                      value={`project ${item.label}`}
                                                      active={isProjectNavActive(item.href, projectBase, pathname)}
                                                      onSelect={() => go(item.href)}
                                                  >
                                                      <item.icon />
                                                      {item.label}
                                                  </PaletteItem>
                                              ))}
                                          </Command.Group>
                                      ) : null}

                                      {organizations?.length ? (
                                          <Command.Group heading="Organizations">
                                              {organizations.map((org) => (
                                                  <PaletteItem
                                                      key={org.id}
                                                      value={`organization ${org.name}`}
                                                      onSelect={() => go(`/dashboard/organizations/${org.id}`)}
                                                  >
                                                      <Building2 />
                                                      {org.name}
                                                  </PaletteItem>
                                              ))}
                                          </Command.Group>
                                      ) : null}

                                      {organizations?.some((org) => org.projects.length > 0) ? (
                                          <Command.Group heading="Projects">
                                              {organizations.flatMap((org) =>
                                                  org.projects.map((project) => (
                                                      <PaletteItem
                                                          key={project.id}
                                                          value={`project ${project.name} ${org.name}`}
                                                          onSelect={() => go(`/dashboard/projects/${project.id}`)}
                                                      >
                                                          <Boxes />
                                                          <span className="min-w-0 flex-1 truncate">
                                                              {project.name}
                                                          </span>
                                                          <span className="truncate text-xs text-muted-foreground">
                                                              {org.name}
                                                          </span>
                                                      </PaletteItem>
                                                  )),
                                              )}
                                          </Command.Group>
                                      ) : null}

                                      <Command.Group heading="Go to">
                                          <PaletteItem value="go organizations home" onSelect={() => go("/dashboard")}>
                                              <Building2 />
                                              All organizations
                                          </PaletteItem>
                                          <PaletteItem value="go live demo" onSelect={() => go("/demo")}>
                                              <Play />
                                              Live demo
                                          </PaletteItem>
                                          <PaletteItem value="go home landing" onSelect={() => go("/")}>
                                              <Home />
                                              Home
                                          </PaletteItem>
                                      </Command.Group>

                                      <Command.Group heading="Actions">
                                          <PaletteItem value="toggle theme dark light" onSelect={toggleTheme}>
                                              <ThemeIcon />
                                              Toggle theme
                                          </PaletteItem>
                                          <PaletteItem value="sign out logout" onSelect={signOut}>
                                              <LogOut />
                                              Sign out
                                          </PaletteItem>
                                      </Command.Group>
                                  </Command.List>
                              </Command>
                          </div>
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}

function PaletteItem({
    value,
    active,
    onSelect,
    children,
}: {
    value: string;
    active?: boolean;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        <Command.Item
            value={value}
            onSelect={onSelect}
            className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                active && "text-primary",
                "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
            )}
        >
            {children}
        </Command.Item>
    );
}

// Rendered client-side only (inside the portal), so reading the class is safe.
function ThemeIcon() {
    return document.documentElement.classList.contains("dark") ? <Sun /> : <Moon />;
}
