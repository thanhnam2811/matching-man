"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogoutButton } from "@/components/logout-button";

type SessionState = { status: "loading" } | { status: "authenticated"; email: string } | { status: "anonymous" };

export function SiteHeader() {
    const [session, setSession] = React.useState<SessionState>({ status: "loading" });

    React.useEffect(() => {
        let cancelled = false;
        fetch("/api/session/me", { cache: "no-store" })
            .then((response) => response.json())
            .then((data: { authenticated: boolean; email?: string }) => {
                if (cancelled) return;
                setSession(
                    data.authenticated && data.email
                        ? { status: "authenticated", email: data.email }
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
                    <span className="inline-block size-2 rounded-full bg-success" />
                    Matching Hub
                </span>
                <div className="flex items-center gap-2">
                    {session.status === "loading" ? (
                        <Skeleton className="h-8 w-40 rounded-full" />
                    ) : session.status === "authenticated" ? (
                        <>
                            <span className="max-w-[10rem] truncate text-sm text-muted-foreground">
                                {session.email}
                            </span>
                            <Link href="/dashboard">
                                <Button variant="ghost" size="sm">
                                    Dashboard
                                </Button>
                            </Link>
                            <LogoutButton />
                        </>
                    ) : (
                        <>
                            <Link href="/demo">
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
