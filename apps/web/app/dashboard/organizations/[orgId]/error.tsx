"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function OrganizationError({ error, reset }: { error: Error; reset: () => void }) {
    return (
        <div className="mx-auto max-w-5xl">
            <ErrorDisplay
                message={parseError(error)}
                retry={reset}
                backHref="/dashboard"
                backLabel="Back to organizations"
            />
        </div>
    );
}
