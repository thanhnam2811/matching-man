"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Minimal, dependency-free dropdown (no Radix). Manages its own open state,
// closes on outside pointerdown and Escape. Items close the menu on click.

const CloseContext = React.createContext<() => void>(() => {});

export function DropdownMenu({
    trigger,
    children,
    align = "end",
    label,
    className,
}: {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: "start" | "end";
    label?: string;
    className?: string;
}) {
    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const close = React.useCallback(() => setOpen(false), []);

    React.useEffect(() => {
        if (!open) return;
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                className="inline-flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {trigger}
            </button>
            {open ? (
                <div
                    role="menu"
                    className={cn(
                        "absolute z-50 mt-2 min-w-52 animate-fade-in rounded-md border bg-card p-1 shadow-md",
                        align === "end" ? "right-0" : "left-0",
                        className,
                    )}
                >
                    <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
                </div>
            ) : null}
        </div>
    );
}

const itemClass =
    "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownItem({
    children,
    href,
    onSelect,
}: {
    children: React.ReactNode;
    href?: string;
    onSelect?: () => void;
}) {
    const close = React.useContext(CloseContext);

    if (href) {
        return (
            <Link role="menuitem" href={href} onClick={close} className={itemClass}>
                {children}
            </Link>
        );
    }

    return (
        <button
            role="menuitem"
            type="button"
            onClick={() => {
                close();
                onSelect?.();
            }}
            className={itemClass}
        >
            {children}
        </button>
    );
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
    return <div className="px-2 py-1.5">{children}</div>;
}

export function DropdownSeparator() {
    return <div role="separator" className="-mx-1 my-1 h-px bg-border" />;
}
