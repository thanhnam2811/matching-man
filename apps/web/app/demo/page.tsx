import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemoPage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
            <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-3" />
                Home
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Live matchmaking demo</h1>
            <p className="text-sm text-muted-foreground">Watch the real engine pair players by skill.</p>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="text-base">Coming up next</CardTitle>
                    <CardDescription>The interactive demo lands in the next slice.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    It will enqueue players against a live demo project and show pools filling and matches forming in
                    real time.
                </CardContent>
            </Card>
        </main>
    );
}