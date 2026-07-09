import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
    return (
        <main className="relative flex min-h-screen items-center justify-center p-4">
            <Link
                href="/"
                className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-3" />
                Back to home
            </Link>
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Matching Hub</CardTitle>
                    <CardDescription>Sign in to manage your organizations and projects.</CardDescription>
                </CardHeader>
                <CardContent>
                    <LoginForm />
                </CardContent>
            </Card>
        </main>
    );
}
