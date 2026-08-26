"use client";

import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { useSession } from "@/lib/use-session";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
    { label: "Features", href: "#features" },
    { label: "Architecture", href: "#architecture" },
    { label: "Code & SDK", href: "#developer-hub" },
    { label: "Pricing", href: "#pricing" },
    { label: "Docs", href: "/v1/docs", isExternal: true },
    { label: "Demo", href: "/demo" },
];

export function SiteHeader() {
    const session = useSession();
    const [mobileOpen, setMobileOpen] = React.useState(false);

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
                {/* Left: Brand + Status */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <BrandMark />
                        <span className="text-sm font-semibold tracking-tight text-foreground">Matching Hub</span>
                    </Link>

                    <div className="hidden lg:inline-flex items-center gap-1.5 rounded-full border bg-muted/30 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-success animate-pulse" />
                        <span>Operational · 24ms p50</span>
                    </div>
                </div>

                {/* Center: Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
                    {NAV_LINKS.map((link) =>
                        link.isExternal ? (
                            <a
                                key={link.label}
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                className="transition-colors hover:text-foreground"
                            >
                                {link.label}
                            </a>
                        ) : (
                            <a key={link.label} href={link.href} className="transition-colors hover:text-foreground">
                                {link.label}
                            </a>
                        ),
                    )}
                </nav>

                {/* Right: Auth & Controls */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <ThemeToggle />

                    {session.status === "loading" ? (
                        <Skeleton className="size-8 rounded-full" />
                    ) : session.status === "authenticated" ? (
                        <UserMenu email={session.email} name={session.name} />
                    ) : (
                        <>
                            <Link href="/login" className="hidden sm:inline-block">
                                <Button variant="ghost" size="sm">
                                    Sign in
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm" className="shadow-xs">
                                    Start free
                                </Button>
                            </Link>
                        </>
                    )}

                    {/* Mobile Menu Button */}
                    <button
                        type="button"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle Navigation"
                        className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground md:hidden hover:bg-muted"
                    >
                        {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileOpen && (
                <div className="border-b bg-card px-6 py-4 md:hidden">
                    <nav className="flex flex-col space-y-3 text-xs font-medium">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="text-muted-foreground hover:text-foreground py-1"
                            >
                                {link.label}
                            </a>
                        ))}
                        {session.status === "anonymous" && (
                            <div className="border-t pt-3 flex flex-col gap-2">
                                <Link href="/login" onClick={() => setMobileOpen(false)}>
                                    <Button variant="outline" size="sm" className="w-full">
                                        Sign in
                                    </Button>
                                </Link>
                                <Link href="/register" onClick={() => setMobileOpen(false)}>
                                    <Button size="sm" className="w-full">
                                        Start free
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}
