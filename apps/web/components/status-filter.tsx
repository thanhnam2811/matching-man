import Link from "next/link";
import { cn } from "@/lib/utils";

// Server-rendered filter chips. Selecting a chip resets pagination (no offset
// in the href) and the empty value clears the filter.
export function StatusFilter({
    basePath,
    current,
    options,
}: {
    basePath: string;
    current?: string;
    options: { value: string; label: string }[];
}) {
    const chips = [{ value: "", label: "All" }, ...options];

    return (
        <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => {
                const active = (current ?? "") === chip.value;
                return (
                    <Link
                        key={chip.value || "all"}
                        href={chip.value ? `${basePath}?status=${chip.value}` : basePath}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            active
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                    >
                        {chip.label}
                    </Link>
                );
            })}
        </div>
    );
}
