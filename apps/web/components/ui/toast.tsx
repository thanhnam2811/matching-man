"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal, dependency-free toaster (no Radix). A module-level pub/sub lets any
// client component call `toast(...)`; a single <Toaster /> mounted in the root
// layout renders the stack.

type ToastVariant = "default" | "success" | "destructive" | "warning";
type ToastItem = { id: number; title?: string; description?: string; variant: ToastVariant };

let counter = 0;
let items: ToastItem[] = [];
const listeners = new Set<(next: ToastItem[]) => void>();

function emit() {
    for (const listener of listeners) {
        listener(items);
    }
}

export function toast(options: { title?: string; description?: string; variant?: ToastVariant; duration?: number }) {
    const id = ++counter;
    items = [
        { id, title: options.title, description: options.description, variant: options.variant ?? "default" },
        ...items,
    ].slice(0, 4);
    emit();
    const duration = options.duration ?? 4000;
    if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
    }
    return id;
}

export function dismissToast(id: number) {
    items = items.filter((item) => item.id !== id);
    emit();
}

const ICONS: Record<ToastVariant, typeof Info> = {
    default: Info,
    success: CheckCircle2,
    destructive: XCircle,
    warning: AlertTriangle,
};

const ICON_COLORS: Record<ToastVariant, string> = {
    default: "text-muted-foreground",
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
};

const BORDERS: Record<ToastVariant, string> = {
    default: "border-border",
    success: "border-success/40",
    destructive: "border-destructive/40",
    warning: "border-warning/40",
};

export function Toaster() {
    const [stack, setStack] = React.useState<ToastItem[]>([]);

    React.useEffect(() => {
        const listener = (next: ToastItem[]) => setStack([...next]);
        listeners.add(listener);
        setStack([...items]);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
            {stack.map((item) => {
                const Icon = ICONS[item.variant];
                return (
                    <div
                        key={item.id}
                        role="status"
                        className={cn(
                            "pointer-events-auto flex items-start gap-3 rounded-md border bg-card p-3 shadow-lg",
                            BORDERS[item.variant],
                        )}
                    >
                        <Icon className={cn("mt-0.5 size-4 shrink-0", ICON_COLORS[item.variant])} />
                        <div className="flex-1 text-sm">
                            {item.title ? <p className="font-medium leading-tight">{item.title}</p> : null}
                            {item.description ? (
                                <p className="text-muted-foreground leading-snug">{item.description}</p>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            aria-label="Dismiss"
                            onClick={() => dismissToast(item.id)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
