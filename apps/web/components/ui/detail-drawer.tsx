"use client";

import { X } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

// Right-hand detail sheet for table rows, at every viewport size.
export function DetailDrawer({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Drawer open={open} onClose={onClose} side="right" desktop label={title} panelClassName="w-full max-w-md">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
                <h2 className="truncate text-sm font-semibold">{title}</h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close details"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <X className="size-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Drawer>
    );
}

export function DetailList({ children }: { children: React.ReactNode }) {
    return <dl className="text-sm">{children}</dl>;
}

export function DetailField({
    label,
    mono = false,
    children,
}: {
    label: string;
    mono?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-0">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className={cn("min-w-0 text-right font-medium [overflow-wrap:anywhere]", mono && "font-mono text-xs")}>
                {children}
            </dd>
        </div>
    );
}
