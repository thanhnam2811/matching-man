"use client";

import * as React from "react";
import { CheckCircle2, Cpu, Database, Radio, ShieldAlert, Sparkles, Webhook, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";

interface PipelineStage {
    id: string;
    stepNumber: string;
    title: string;
    tagline: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
    details: {
        heading: string;
        description: string;
        codeSnippet?: string;
        specs: Array<{ key: string; value: string }>;
    };
}

const STAGES: PipelineStage[] = [
    {
        id: "enqueue",
        stepNumber: "01",
        title: "Enqueue Ingest",
        tagline: "High-throughput API & Solo/Party validation",
        icon: Zap,
        badge: "HTTP / Ingest",
        details: {
            heading: "Idempotent Queue Ingest",
            description:
                "Game servers submit solo players or premade parties with skill ratings (Elo/MMR) and regional latency vectors. Every request is verified via SHA-256 project API keys and deduplicated via Idempotency-Key headers.",
            codeSnippet: `POST /v1/queues/enqueue
Authorization: Bearer key_live_99a8...
Idempotency-Key: enq_1724688000_party_bravo
{
  "projectId": "proj_123",
  "gameModeId": "mode_ranked_5v5",
  "team": { "members": [{ "playerId": "p1", "rating": 1540 }] }
}`,
            specs: [
                { key: "Throughput", value: "2,000+ req/s" },
                { key: "Auth Model", value: "SHA-256 Project API Key" },
                { key: "Deduplication", value: "Strict Idempotency-Key" },
            ],
        },
    },
    {
        id: "worker",
        stepNumber: "02",
        title: "Partitioned Pool Worker",
        tagline: "BullMQ queue concurrency with row-level locks",
        icon: Cpu,
        badge: "BullMQ / Redis",
        details: {
            heading: "Lock-Free Sharded Queue Processing",
            description:
                "Queued candidates are partitioned by project, game mode, and regional cluster. Dedicated BullMQ workers process candidate pools in debounced 50ms batches with row-level PostgreSQL transaction safety, preventing race conditions across worker nodes.",
            codeSnippet: `// Worker Queue Partition
const poolKey = \`\${projectId}:\${environment}:\${gameModeId}:\${region}\`;
await matchmakingPoolQueue.add(
  "process-pool",
  { poolKey, projectId },
  { jobId: \`pool-\${poolKey}\`, debounce: { id: poolKey, ttl: 50 } }
);`,
            specs: [
                { key: "Batching Tick", value: "50ms Debounce" },
                { key: "Concurrency", value: "Isolated per Pool Key" },
                { key: "State Lock", value: "PostgreSQL SELECT FOR UPDATE" },
            ],
        },
    },
    {
        id: "expansion",
        stepNumber: "03",
        title: "Dynamic Elo Window",
        tagline: "Expanding rating tolerance avoids infinite queues",
        icon: Radio,
        badge: "Rating Engine",
        details: {
            heading: "Slot Assembling & Skill Tolerance Expansion",
            description:
                "The engine evaluates candidate party sizes and skill brackets. Initial matches strictly enforce tight rating gaps (e.g. ±50 MMR). As wait time increases, the rating search window smoothly widens (±25 MMR every 15s) until a fair match is assembled.",
            codeSnippet: `// Dynamic rating window calculation
const elapsedSeconds = (Date.now() - entry.createdAt) / 1000;
const expansionSteps = Math.floor(elapsedSeconds / 15);
const allowedSkillGap = initialTolerance + (expansionSteps * expandStep);
// Evaluates candidate slot pairing...`,
            specs: [
                { key: "Rating Modes", value: "Internal Elo / BYO / Neutral" },
                { key: "Window Step", value: "Configurable per Game Mode" },
                { key: "Topology", value: "1v1, 5v5, FFA, Custom Slots" },
            ],
        },
    },
    {
        id: "readycheck",
        stepNumber: "04",
        title: "Ready Check & Guard",
        tagline: "Two-way participant handshake & penalty ladders",
        icon: ShieldAlert,
        badge: "Match Governance",
        details: {
            heading: "Two-Way Ready Handshake & Queue Safety",
            description:
                "When candidate slots form, players confirm participation via a 15–30s countdown handshake. If a player declines or times out, the offending player is locked out with an escalating penalty ladder while non-dodging teammates return to the front of the queue.",
            codeSnippet: `POST /v1/matches/match_88f912c4/accept
{ "playerId": "usr_vanguard_01", "teamId": "team_bravo" }

// Response on completion:
{ "matchId": "match_88f912c4", "status": "confirmed", "isComplete": true }`,
            specs: [
                { key: "Handshake Window", value: "10s – 60s Configurable" },
                { key: "Dodge Penalty", value: "Escalating Lockout Ladder" },
                { key: "Queue Preservation", value: "Priority Queue Restoration" },
            ],
        },
    },
    {
        id: "webhook",
        stepNumber: "05",
        title: "HMAC Webhook Delivery",
        tagline: "SHA-256 signatures with exponential backoff",
        icon: Webhook,
        badge: "Event Dispatch",
        details: {
            heading: "Cryptographic Match Dispatch",
            description:
                "Once confirmed, the match payload is delivered directly to your game server webhook with HMAC-SHA256 signatures and timestamp replay protection. Unresponsive endpoints trigger exponential retries with live delivery audit logs in your dashboard.",
            codeSnippet: `POST https://game.example.com/api/matchmaking-webhook
X-Webhook-Event: match.confirmed
X-Webhook-Timestamp: 1724688015
X-Webhook-Signature: sha256=d3f82b7c4a1e905a...

{
  "event": "match.confirmed",
  "data": { "matchId": "match_88f912c4", "slots": [...] }
}`,
            specs: [
                { key: "Signature", value: "HMAC-SHA256 (Constant-Time)" },
                { key: "Retry Strategy", value: "10 Attempts Exponential Backoff" },
                { key: "Payload Audit", value: "Real-Time Delivery Logs" },
            ],
        },
    },
];

export function ArchitecturePipeline() {
    const [selectedStage, setSelectedStage] = React.useState<string>("enqueue");
    const activeStage = STAGES.find((s) => s.id === selectedStage) ?? STAGES[0];

    return (
        <section className="mx-auto w-full max-w-6xl px-6 py-20" id="architecture">
            <Reveal className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="size-3.5 text-foreground" />
                    Deterministic Engine Architecture
                </span>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                    From enqueue to game server in sub-50ms
                </h2>
                <p className="mt-3 text-balance text-muted-foreground">
                    A multi-tenant, event-driven engine engineered for high-concurrency multiplayer games with zero
                    state contention.
                </p>
            </Reveal>

            {/* Stage Selector Bar */}
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-5">
                {STAGES.map((stage) => {
                    const isSelected = selectedStage === stage.id;
                    const Icon = stage.icon;
                    return (
                        <button
                            key={stage.id}
                            type="button"
                            onClick={() => setSelectedStage(stage.id)}
                            className={`group relative flex flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 ${
                                isSelected
                                    ? "border-foreground/40 bg-card shadow-xs ring-1 ring-foreground/20"
                                    : "border-border bg-muted/10 hover:border-border hover:bg-muted/30"
                            }`}
                        >
                            <div className="mb-2 flex w-full items-center justify-between">
                                <span
                                    className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                        isSelected
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground"
                                    }`}
                                >
                                    {stage.stepNumber}
                                </span>
                                <Icon
                                    className={`size-4 transition-colors ${
                                        isSelected
                                            ? "text-foreground"
                                            : "text-muted-foreground group-hover:text-foreground"
                                    }`}
                                />
                            </div>
                            <div className="font-medium text-xs text-foreground">{stage.title}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{stage.tagline}</div>
                        </button>
                    );
                })}
            </div>

            {/* Active Stage Deep-Dive Card */}
            <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-xs">
                <div className="border-b bg-muted/30 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-lg border bg-background">
                            <activeStage.icon className="size-4.5 text-foreground" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-muted-foreground">
                                    STEP {activeStage.stepNumber}
                                </span>
                                <span className="text-sm font-semibold text-foreground">
                                    {activeStage.details.heading}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{activeStage.tagline}</p>
                        </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[11px]">
                        {activeStage.badge}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
                    {/* Left: Description & Specs */}
                    <div className="flex flex-col justify-between space-y-6 lg:col-span-6">
                        <div>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                                {activeStage.details.description}
                            </p>
                        </div>

                        <div className="space-y-3 rounded-lg border bg-muted/10 p-4">
                            <div className="text-xs font-medium text-foreground">Engine Specification</div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {activeStage.details.specs.map((spec) => (
                                    <div key={spec.key} className="rounded-md border bg-card p-2.5">
                                        <div className="text-[10px] text-muted-foreground uppercase font-mono">
                                            {spec.key}
                                        </div>
                                        <div className="mt-0.5 text-xs font-semibold text-foreground font-mono">
                                            {spec.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Code Sample */}
                    <div className="lg:col-span-6">
                        <div className="overflow-hidden rounded-lg border bg-background font-mono text-xs shadow-inner">
                            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <Database className="size-3 text-muted-foreground" />
                                    Engine Protocol
                                </span>
                                <span className="text-success flex items-center gap-1">
                                    <CheckCircle2 className="size-3" />
                                    Active
                                </span>
                            </div>
                            <pre className="overflow-x-auto p-4 leading-relaxed text-foreground/90 max-h-[220px]">
                                <code>{activeStage.details.codeSnippet}</code>
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
