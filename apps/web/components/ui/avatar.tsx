import { cn } from "@/lib/utils";

// Derives up to two initials from a name or email for the avatar fallback.
export function initialsFrom(nameOrEmail: string): string {
    const value = nameOrEmail.trim();
    if (!value) return "?";

    if (value.includes("@")) {
        const local = value
            .split("@")[0]!
            .replace(/[._-]+/g, " ")
            .trim();
        const parts = local.split(/\s+/).filter(Boolean);
        const chars = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : local.slice(0, 2);
        return chars.toUpperCase();
    }

    const parts = value.split(/\s+/).filter(Boolean);
    const chars = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : value.slice(0, 2);
    return chars.toUpperCase();
}

export function Avatar({ fallback, className }: { fallback: string; className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex size-8 select-none items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground",
                className,
            )}
        >
            {fallback}
        </span>
    );
}
