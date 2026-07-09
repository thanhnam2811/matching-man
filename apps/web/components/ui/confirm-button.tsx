"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

// Inline two-step confirm for destructive form submits (no modal, per DESIGN.md).
// First click arms it and reveals a destructive submit + Cancel; the confirm
// button is `type="submit"`, so it posts the parent <form>. While the server
// action runs it shows a spinner via `useFormStatus`. Auto-disarms after a few
// seconds so a stray arm doesn't linger.
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
            <ConfirmSubmit size={size}>{confirmLabel}</ConfirmSubmit>
            <CancelButton size={size} onCancel={() => setArmed(false)} />
        </span>
    );
}

function ConfirmSubmit({ children, size }: { children: React.ReactNode; size?: ButtonProps["size"] }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="destructive" size={size} loading={pending}>
            {children}
        </Button>
    );
}

function CancelButton({ size, onCancel }: { size?: ButtonProps["size"]; onCancel: () => void }) {
    const { pending } = useFormStatus();
    return (
        <Button type="button" variant="ghost" size={size} onClick={onCancel} disabled={pending}>
            Cancel
        </Button>
    );
}
