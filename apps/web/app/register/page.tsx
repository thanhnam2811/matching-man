import { RegisterForm } from "@/components/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Create your account</CardTitle>
                    <CardDescription>You will start with your own organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <RegisterForm />
                </CardContent>
            </Card>
        </main>
    );
}
