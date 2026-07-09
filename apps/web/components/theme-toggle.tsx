"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// Toggles the `dark` class on <html> and persists the choice. The initial class
// is applied by a blocking inline script in the root layout (no FOUC); this only
// reads/flips it after mount, so it renders a neutral placeholder until then to
// avoid a hydration mismatch.
export function ThemeToggle({ className }: { className?: string }) {
    const [isDark, setIsDark] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
    }, []);

    function toggle() {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            // ignore storage failures (private mode etc.)
        }
        setIsDark(next);
    }

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Toggle color theme"
            className={cn(
                "inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                className,
            )}
        >
            {isDark === null ? (
                <span className="size-4" />
            ) : isDark ? (
                <Sun className="size-4" />
            ) : (
                <Moon className="size-4" />
            )}
        </button>
    );
}
