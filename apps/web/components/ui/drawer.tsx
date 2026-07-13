"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Hand-rolled off-canvas drawer (no Radix). Stays mounted so it can animate open
// AND closed; closes on backdrop tap and Escape; locks body scroll while open.
// `lg:hidden` — this is the mobile/tablet navigation surface only; the desktop
// sidebar takes over at lg.
//
// Rendered through a portal to <body> so it escapes any ancestor with a
// `filter`/`backdrop-filter`/`transform` (e.g. the sticky `backdrop-blur`
// header), which would otherwise become the containing block for `fixed` and
// break the full-screen overlay.
export function Drawer({
    open,
    onClose,
    children,
    side = "left",
    label,
}: {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    side?: "left" | "right";
    label?: string;
}) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    React.useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            document.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div className={cn("fixed inset-0 z-50 lg:hidden", !open && "pointer-events-none")} aria-hidden={!open}>
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-black/60 transition-opacity duration-300",
                    open ? "opacity-100" : "opacity-0",
                )}
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className={cn(
                    "absolute inset-y-0 flex w-72 max-w-[82%] flex-col bg-background shadow-xl transition-transform duration-300 ease-out",
                    side === "left" ? "left-0 border-r" : "right-0 border-l",
                    open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
                )}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
