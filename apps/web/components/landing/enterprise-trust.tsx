import * as React from "react";
import { KeyRound, Lock, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "./reveal";

const PILLARS = [
    {
        icon: KeyRound,
        title: "Cryptographic Payload Integrity",
        description:
            "Every outbound webhook callback is signed with SHA-256 HMAC secret tokens (X-Webhook-Signature) with timestamp replay protection. API keys are scrypt/sha256 hashed and never stored or returned in plaintext.",
    },
    {
        icon: ShieldCheck,
        title: "Immutable Audit Trail (SOC2-Ready)",
        description:
            "Tamper-evident audit logging captures actor IDs, IP origins, sanitized User-Agents, and granular before/after diffs for all match formations, rating updates, API key rotations, and member invites.",
    },
    {
        icon: Server,
        title: "High-Throughput Isolation",
        description:
            "Architected with isolated BullMQ workers, partitioned Redis atomic pipelines, and PostgreSQL row-level locks to ensure zero race conditions across distributed game servers.",
    },
    {
        icon: Lock,
        title: "Zero-Trust Multi-Tenancy",
        description:
            "Strict isolation across organizations, projects, and environments (production, staging, development). Scoped token guards guarantee teams only access their dedicated resources.",
    },
];

export function EnterpriseTrust() {
    return (
        <section className="border-t bg-muted/20 py-20" id="security">
            <div className="mx-auto max-w-6xl px-6">
                <Reveal className="mx-auto max-w-2xl text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Sparkles className="size-3.5 text-foreground" />
                        Enterprise Governance & Trust
                    </span>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                        Engineered for mission-critical game backends
                    </h2>
                    <p className="mt-3 text-balance text-muted-foreground">
                        Battle-hardened reliability, cryptographic verification, and tamper-evident audit logging out of
                        the box.
                    </p>
                </Reveal>

                <div className="mt-12 grid gap-6 sm:grid-cols-2">
                    {PILLARS.map((pillar, index) => (
                        <Reveal key={pillar.title} delayMs={index * 60}>
                            <Card className="h-full border-border bg-card">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
                                            <pillar.icon className="size-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-foreground">{pillar.title}</h3>
                                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                                {pillar.description}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Reveal>
                    ))}
                </div>

                {/* Trust Badges Banner */}
                <div className="mt-10 rounded-xl border bg-card/60 p-6">
                    <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                        <div className="space-y-1">
                            <div className="font-mono text-base font-bold text-foreground">HMAC-SHA256</div>
                            <div className="text-[11px] text-muted-foreground">Outbound Cryptography</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-mono text-base font-bold text-foreground">90d / 365d</div>
                            <div className="text-[11px] text-muted-foreground">Audit Log Retention</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-mono text-base font-bold text-foreground">99.99%</div>
                            <div className="text-[11px] text-muted-foreground">Uptime SLA Target</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-mono text-base font-bold text-foreground">OpenAPI 3.1</div>
                            <div className="text-[11px] text-muted-foreground">Strict Schema Contract</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
