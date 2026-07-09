"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="mx-auto max-w-5xl">
            <ErrorDisplay
                title="Something went wrong"
                message={parseError(error)}
                retry={reset}
                backHref="/dashboard"
                backLabel="Back to dashboard"
            />
        </div>
    );
}
