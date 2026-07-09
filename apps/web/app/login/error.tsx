"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function LoginError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <main className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <ErrorDisplay title="Failed to load sign in page" message={parseError(error)} retry={reset} />
            </div>
        </main>
    );
}
