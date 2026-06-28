"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Adds a scroll-reveal transition (see .reveal in globals.css) the first time the
// element scrolls into view. No-op visually under prefers-reduced-motion.
export function Reveal({
    className,
    delayMs = 0,
    children,
}: {
    className?: string;
    delayMs?: number;
    children: React.ReactNode;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [visible, setVisible] = React.useState(false);

    React.useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setVisible(true);
                        observer.disconnect();
                    }
                }
            },
            { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={cn("reveal", visible && "is-visible", className)}
            style={{ transitionDelay: `${delayMs}ms` }}
        >
            {children}
        </div>
    );
}
