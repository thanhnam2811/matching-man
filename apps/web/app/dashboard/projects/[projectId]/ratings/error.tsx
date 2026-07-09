"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function RatingsError({ error, reset }: { error: Error; reset: () => void }) {
    return <ErrorDisplay title="Failed to load ratings" message={parseError(error)} retry={reset} />;
}
