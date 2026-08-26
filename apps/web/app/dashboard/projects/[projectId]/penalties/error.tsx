"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function PenaltiesError({ error, reset }: { error: Error; reset: () => void }) {
    return <ErrorDisplay title="Failed to load player penalties" message={parseError(error)} retry={reset} />;
}
