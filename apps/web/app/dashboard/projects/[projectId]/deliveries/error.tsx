"use client";

import { ErrorDisplay, parseError } from "@/components/ui/error-display";

export default function DeliveriesError({ error, reset }: { error: Error; reset: () => void }) {
    return <ErrorDisplay title="Failed to load deliveries" message={parseError(error)} retry={reset} />;
}
