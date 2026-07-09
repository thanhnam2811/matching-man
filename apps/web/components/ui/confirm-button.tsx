"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

// Inline two-step confirm for destructive form submits (no modal, per DESIGN.md).
// First click arms it and reveals a destructive submit + Cancel; the confirm
// button is `type="submit"`, so it posts the parent <form>. Auto-disarms after a
// few seconds so a stray arm doesn't linger.
export function ConfirmButton({
    children,
    confirmLabel = "Confirm",
    size = "sm",
}: {
    children: React.ReactNode;
    confirmLabel?: React.ReactNode;
    size?: ButtonProps["size"];
}) {
    const [armed, setArmed] = React.useState(false);
    const timer = React.useRef<number | undefined>(undefined);

    React.useEffect(() => () => window.clearTimeout(timer.current), []);

    function arm() {
        setArmed(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setArmed(false), 4000);
    }

    if (!armed) {
        return (
            <Button type="button" variant="ghost" size={size} onClick={arm}>
                {children}
            </Button>
        );
    }

    return (
        <span className="inline-flex items-center gap-1">
            <Button type="submit" variant="destructive" size={size}>
                {confirmLabel}
            </Button>
            <Button type="button" variant="ghost" size={size} onClick={() => setArmed(false)}>
                Cancel
            </Button>
        </span>
    );
}
