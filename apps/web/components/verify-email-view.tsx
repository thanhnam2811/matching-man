"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { verifyEmailAction } from "@/lib/actions";

export function VerifyEmailView() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [status, setStatus] = React.useState<"verifying" | "success" | "error">(token ? "verifying" : "error");
    const [errorMessage, setErrorMessage] = React.useState<string | null>(
        token ? null : "No verification token found in URL.",
    );

    React.useEffect(() => {
        if (!token) return;

        let active = true;
        verifyEmailAction(token)
            .then((res) => {
                if (active) {
                    if (res.success) {
                        setStatus("success");
                    } else {
                        setStatus("error");
                        setErrorMessage(res.error || "Invalid or expired verification token.");
                    }
                }
            })
            .catch((err) => {
                if (active) {
                    setStatus("error");
                    setErrorMessage(err.message || "Invalid or expired verification token.");
                }
            });

        return () => {
            active = false;
        };
    }, [token]);

    if (status === "verifying") {
        return (
            <div className="flex flex-col items-center justify-center space-y-3 py-8 text-center">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground">Verifying your email address…</p>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-foreground" />
                    <div className="space-y-1 text-sm">
                        <p className="font-medium text-foreground">Email verified</p>
                        <p className="text-muted-foreground">
                            Thank you for verifying your email address. Your account is now in full standing.
                        </p>
                    </div>
                </div>

                <Button asChild className="w-full">
                    <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <XCircle className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-1">
                    <p className="font-medium">Verification failed</p>
                    <p className="text-destructive/90">{errorMessage}</p>
                </div>
            </div>

            <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
        </div>
    );
}
