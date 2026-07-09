import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
                    <p className="text-sm text-muted-foreground">Sign in to manage your organizations and projects.</p>
                </div>
                <LoginForm />
            </div>
        </AuthShell>
    );
}
