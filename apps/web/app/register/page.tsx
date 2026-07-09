import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
    return (
        <AuthShell>
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
                    <p className="text-sm text-muted-foreground">You will start with your own organization.</p>
                </div>
                <RegisterForm />
            </div>
        </AuthShell>
    );
}
