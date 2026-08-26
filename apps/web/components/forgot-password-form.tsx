"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction } from "@/lib/actions";

export function ForgotPasswordForm() {
    const [email, setEmail] = React.useState("");
    const [submitted, setSubmitted] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setPending(true);

        try {
            const res = await forgotPasswordAction(email);
            if (res.success) {
                setSubmitted(true);
            } else {
                setError(res.error || "Failed to send reset email.");
            }
        } catch {
            setError("Unable to reach the server. Please try again later.");
        } finally {
            setPending(false);
        }
    }

    if (submitted) {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground" />
                    <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">Check your inbox</p>
                        <p className="text-muted-foreground">
                            If an account is associated with <span className="font-mono text-foreground">{email}</span>,
                            we have sent password reset instructions. The link expires in 15 minutes.
                        </p>
                    </div>
                </div>

                <Button asChild variant="outline" className="w-full">
                    <Link href="/login" className="inline-flex items-center justify-center gap-2">
                        <ArrowLeft className="size-4" />
                        Back to sign in
                    </Link>
                </Button>
            </div>
        );
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

            {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending || !email}>
                {pending ? "Sending link…" : "Send reset link"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
                Remember your password?{" "}
                <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
