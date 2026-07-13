import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/sparkline";

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    href,
    sparkline,
}: {
    label: string;
    value: string;
    hint?: string;
    icon: LucideIcon;
    href?: string;
    sparkline?: number[];
}) {
    const card = (
        <Card
            className={
                href
                    ? "h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md"
                    : "h-full"
            }
        >
            <CardContent className="flex h-full items-start justify-between gap-3 p-5">
                <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5 shrink-0" />
                        {label}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
                    {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
                </div>
                {sparkline ? (
                    // Validated on both surfaces: indigo-600 on light, indigo-500 on dark.
                    <Sparkline values={sparkline} className="mt-1 text-indigo-600 dark:text-indigo-500" />
                ) : null}
            </CardContent>
        </Card>
    );

    return href ? (
        <Link href={href} className="group block h-full">
            {card}
        </Link>
    ) : (
        card
    );
}
