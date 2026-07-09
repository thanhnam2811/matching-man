"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [pending, setPending] = React.useState<null | "login" | "demo">(null);

    async function submitSession(action: "login" | "demo", init: RequestInit) {
        setError(null);
        setPending(action);

        try {
            const response = await fetch(action === "demo" ? "/api/session/demo" : "/api/session", init);

            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                setError(body?.error ?? "Sign in failed");
                return;
            }

            router.replace("/dashboard");
            router.refresh();
        } catch {
            setError("Unable to reach the server");
        } finally {
            setPending(null);
        }
    }

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        await submitSession("login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
    }

    function onDemo() {
        void submitSession("demo", { method: "POST" });
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                />
            </div>

            {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending !== null || !email || !password}>
                {pending === "login" ? "Signing in…" : "Sign in"}
            </Button>

            <Button type="button" variant="outline" className="w-full" onClick={onDemo} disabled={pending !== null}>
                {pending === "demo" ? "Loading demo…" : "View the demo"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
                No account?{" "}
                <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
                    Create one
                </Link>
            </p>
        </form>
    );
}
