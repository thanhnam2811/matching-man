"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
    const router = useRouter();
    const [token, setToken] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [pending, setPending] = React.useState(false);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setPending(true);

        try {
            const response = await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as { error?: string } | null;
                setError(body?.error ?? "Sign in failed");
                return;
            }

            router.replace("/");
            router.refresh();
        } catch {
            setError("Unable to reach the server");
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="token">Dashboard admin token</Label>
                <Input
                    id="token"
                    type="password"
                    autoComplete="off"
                    placeholder="Paste your admin bearer token"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    required
                />
            </div>

            {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending || token.trim().length === 0}>
                {pending ? "Signing in…" : "Sign in"}
            </Button>
        </form>
    );
}