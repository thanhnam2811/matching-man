import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
    title: "Choose New Password - Matching Man",
    description: "Set a new password for your Matching Man account.",
};

export default function ResetPasswordPage() {
    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">Set new password</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your new password below to regain access to your account.
                    </p>
                </div>
                <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </AuthShell>
    );
}
