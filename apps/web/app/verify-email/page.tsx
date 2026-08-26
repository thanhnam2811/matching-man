import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailView } from "@/components/verify-email-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
    title: "Verify Email - Matching Man",
    description: "Confirm your email address for your Matching Man account.",
};

export default function VerifyEmailPage() {
    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">Email verification</h1>
                    <p className="text-sm text-muted-foreground">
                        Confirming your email address to protect your organizations and projects.
                    </p>
                </div>
                <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                    <VerifyEmailView />
                </Suspense>
            </div>
        </AuthShell>
    );
}
