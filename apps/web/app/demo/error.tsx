"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function DemoError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">
            <ErrorDisplay
                title="Failed to load demo"
                message={parseError(error)}
                retry={reset}
                backHref="/"
                backLabel="Back to home"
            />
        </main>
    );
}
