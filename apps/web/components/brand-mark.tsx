import { cn } from "@/lib/utils";

// Industrial monochrome brand mark for "Matching Hub": two dots meeting, a nod to matchmaking.
export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 border border-zinc-700 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-300 shadow-sm",
                className,
            )}
        >
            <span className="flex items-center">
                <span className="size-1.5 rounded-full bg-current opacity-95" />
                <span className="-ml-0.5 size-1.5 rounded-full bg-current opacity-60" />
            </span>
        </span>
    );
}
