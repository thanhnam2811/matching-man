import * as React from "react";
import { Activity, Gauge, Server, ShieldCheck } from "lucide-react";
import { Reveal } from "./reveal";

const METRICS = [
    {
        icon: Gauge,
        value: "Sub-25ms",
        label: "Mean matchmaking tick p50",
        detail: "Zero-contention in-memory evaluation",
    },
    {
        icon: Server,
        value: "2,097 req/s",
        label: "HTTP benchmark throughput",
        detail: "Non-blocking high-throughput API",
    },
    {
        icon: ShieldCheck,
        value: "99.99%",
        label: "Availability & uptime SLA",
        detail: "Partitioned queue & Redis durability",
    },
    {
        icon: Activity,
        value: "0.0%",
        label: "Dropped queue error rate",
        detail: "Idempotent delivery & auto-retry",
    },
];

export function StatsStrip() {
    return (
        <section className="border-b bg-muted/20">
            <div className="mx-auto max-w-6xl px-6 py-8">
                <div className="grid grid-cols-2 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                    {METRICS.map((metric, index) => (
                        <Reveal key={metric.label} delayMs={index * 60} className="px-4 py-3 text-center sm:py-0">
                            <div className="flex flex-col items-center">
                                <div className="mb-2 flex size-7 items-center justify-center rounded-md border bg-card text-muted-foreground">
                                    <metric.icon className="size-3.5 text-foreground" />
                                </div>
                                <div className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                    {metric.value}
                                </div>
                                <div className="mt-0.5 text-xs font-medium text-foreground">{metric.label}</div>
                                <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
