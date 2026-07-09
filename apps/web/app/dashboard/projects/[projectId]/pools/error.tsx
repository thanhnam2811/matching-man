"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function PoolsError({ error, reset }: { error: Error; reset: () => void }) {
    return <ErrorDisplay title="Failed to load pools" message={parseError(error)} retry={reset} />;
}
