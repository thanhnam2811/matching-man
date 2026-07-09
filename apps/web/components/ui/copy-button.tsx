"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

// Small clipboard button for mono values (IDs, keys, URLs). Shows a check for a
// beat after copying.
export function CopyButton({
    value,
    label = "Copy",
    className,
}: {
    value: string;
    label?: string;
    className?: string;
}) {
    const [copied, setCopied] = React.useState(false);
    const timer = React.useRef<number | undefined>(undefined);

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            return;
        }
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1500);
    }

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : label}
            title={copied ? "Copied" : label}
            className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                className,
            )}
        >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        </button>
    );
}
