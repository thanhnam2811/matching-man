"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { DemoStatus } from "@/lib/api";

function formatCountdown(ms: number): string {
    if (ms <= 0) return "now";
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = Math.floor((ms % 60_000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

export function DemoBanner({ demo }: { demo: DemoStatus }) {
    const resetTime = demo.nextResetAt ? new Date(demo.nextResetAt).getTime() : null;
    const [now, setNow] = React.useState<number | null>(null);

    // Only tick client-side so server and first client render match (no hydration mismatch).
    React.useEffect(() => {
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const countdown =
        resetTime !== null && now !== null ? (
            <>
                {" "}
                — data resets in <span className="font-medium tabular-nums">{formatCountdown(resetTime - now)}</span>
            </>
        ) : null;

    return (
        <div
            role="status"
            className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground md:px-6"
        >
            <Sparkles className="size-4 shrink-0 text-warning" aria-hidden />
            <p>
                You&apos;re exploring the <span className="font-medium">shared demo account</span>. Feel free to click
                around — everything is read/write and shared with other visitors{countdown}.
            </p>
        </div>
    );
}
