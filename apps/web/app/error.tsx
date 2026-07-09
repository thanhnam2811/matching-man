"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-destructive/40 bg-destructive/5">
                <AlertTriangle className="size-5 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
                An unexpected error occurred. Try again, or head back to the homepage.
            </p>
            <div className="flex gap-2">
                <Button onClick={reset}>Try again</Button>
                <Link href="/">
                    <Button variant="outline">Go home</Button>
                </Link>
            </div>
        </main>
    );
}
