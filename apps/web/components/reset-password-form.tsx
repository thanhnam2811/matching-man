"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { resetPasswordAction } from "@/lib/actions";

export function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [submitted, setSubmitted] = React.useState(false);
    const [pending, setPending] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);

        if (!token) {
            setError("Reset token is missing from the URL. Please re-open the link from your email.");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setPending(true);

        try {
            const res = await resetPasswordAction(token, password);
            if (res.success) {
                setSubmitted(true);
            } else {
                setError(res.error || "Failed to reset password. The link may have expired.");
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
                        <p className="font-medium text-foreground">Password updated</p>
                        <p className="text-muted-foreground">
                            Your password has been changed successfully. You can now sign in with your new credentials.
                        </p>
                    </div>
                </div>

                <Button asChild className="w-full">
                    <Link href="/login">Sign in to your account</Link>
                </Button>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="space-y-4">
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    No password reset token provided. Please click the link received in your email.
                </p>
                <Button asChild variant="outline" className="w-full">
                    <Link href="/forgot-password" className="inline-flex items-center justify-center gap-2">
                        <ArrowLeft className="size-4" />
                        Request a new link
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                />
                <PasswordStrength value={password} />
            </div>

            <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                />
            </div>

            {error ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending || !password || !confirmPassword}>
                {pending ? "Resetting password…" : "Save new password"}
            </Button>
        </form>
    );
}
