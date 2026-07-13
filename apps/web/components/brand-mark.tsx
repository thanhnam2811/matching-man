import { cn } from "@/lib/utils";

// Gradient brand mark for "Matching Hub": two dots meeting, a nod to matchmaking.
export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm",
                className,
            )}
        >
            <span className="flex items-center">
                <span className="size-1.5 rounded-full bg-white/95" />
                <span className="-ml-0.5 size-1.5 rounded-full bg-white/60" />
            </span>
        </span>
    );
}
