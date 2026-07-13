"use client";

import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

type SessionState =
    | { status: "loading" }
    | { status: "authenticated"; email: string; name: string | null }
    | { status: "anonymous" };

export function SiteHeader() {
    const [session, setSession] = React.useState<SessionState>({ status: "loading" });

    React.useEffect(() => {
        let cancelled = false;
        fetch("/api/session/me", { cache: "no-store" })
            .then((response) => response.json())
            .then((data: { authenticated: boolean; email?: string; name?: string | null }) => {
                if (cancelled) return;
                setSession(
                    data.authenticated && data.email
                        ? { status: "authenticated", email: data.email, name: data.name ?? null }
                        : { status: "anonymous" },
                );
            })
            .catch(() => {
                if (!cancelled) setSession({ status: "anonymous" });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
                <span className="flex items-center gap-2 font-semibold">
                    <BrandMark />
                    Matching Hub
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                    <ThemeToggle />
                    {session.status === "loading" ? (
                        <Skeleton className="size-8 rounded-full" />
                    ) : session.status === "authenticated" ? (
                        <UserMenu email={session.email} name={session.name} />
                    ) : (
                        <>
                            <Link href="/demo" className="hidden sm:block">
                                <Button variant="ghost" size="sm">
                                    Demo
                                </Button>
                            </Link>
                            <Link href="/login">
                                <Button variant="ghost" size="sm">
                                    Sign in
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm">Start free</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
