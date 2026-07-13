import { cn } from "@/lib/utils";

// Minimal single-series sparkline (pure SVG, server-renderable). Decorative:
// the stat tile next to it carries the actual numbers, so it's aria-hidden.
export function Sparkline({
    values,
    width = 120,
    height = 36,
    className,
}: {
    values: number[];
    width?: number;
    height?: number;
    className?: string;
}) {
    if (values.length < 2) return null;

    const max = Math.max(...values, 1);
    const pad = 2; // keep the 2px stroke inside the viewBox
    const stepX = (width - pad * 2) / (values.length - 1);
    const points = values
        .map((value, index) => {
            const x = pad + index * stepX;
            const y = pad + (1 - value / max) * (height - pad * 2);
            return `${x},${y}`;
        })
        .join(" ");

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            aria-hidden
            className={cn("shrink-0", className)}
        >
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
