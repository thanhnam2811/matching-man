import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = {
    title: "Forgot Password - Matching Man",
    description: "Request a password reset link for your Matching Man operator account.",
};

export default function ForgotPasswordPage() {
    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter your email address and we'll send a password recovery link.
                    </p>
                </div>
                <ForgotPasswordForm />
            </div>
        </AuthShell>
    );
}
