"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function ProjectError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="mx-auto max-w-6xl">
            <ErrorDisplay
                message={parseError(error)}
                retry={reset}
                backHref="/dashboard"
                backLabel="Back to organization"
            />
        </div>
    );
}
