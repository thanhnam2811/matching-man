"use client";

import * as React from "react";

export type SessionState =
    | { status: "loading" }
    | { status: "authenticated"; email: string; name: string | null }
    | { status: "anonymous" };

export function useSession(): SessionState {
    const [session, setSession] = React.useState<SessionState>({ status: "loading" });

    React.useEffect(() => {
        let cancelled = false;
        fetch("/api/session/me", { cache: "no-store" })
            .then((res) => res.json())
            .then((data: { authenticated?: boolean; email?: string; name?: string | null }) => {
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

    return session;
}
