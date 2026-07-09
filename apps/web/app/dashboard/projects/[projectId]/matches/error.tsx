"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function MatchesError({ error, reset }: { error: Error; reset: () => void }) {
    return <ErrorDisplay title="Failed to load matches" message={parseError(error)} retry={reset} />;
}
