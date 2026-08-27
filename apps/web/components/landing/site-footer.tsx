import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
    return (
        <footer className="border-t bg-card/40">
            <div className="mx-auto max-w-6xl px-6 py-16">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
                    {/* Brand & Mission */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2">
                            <BrandMark className="size-5" />
                            <span className="font-semibold text-sm tracking-tight text-foreground">Matching Hub</span>
                        </Link>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                            Deterministic matchmaking, rating algorithms, and event delivery infrastructure for modern
                            multiplayer games.
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
                            <span className="size-1.5 rounded-full bg-success animate-pulse" />
                            <span>Operational · 24ms p50</span>
                        </div>
                    </div>

                    {/* Column 1: Product */}
                    <div>
                        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                            Product
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <li>
                                <a href="#features" className="hover:text-foreground transition-colors">
                                    Features
                                </a>
                            </li>
                            <li>
                                <a href="#architecture" className="hover:text-foreground transition-colors">
                                    5-Stage Pipeline
                                </a>
                            </li>
                            <li>
                                <a href="#pricing" className="hover:text-foreground transition-colors">
                                    Pricing & Plans
                                </a>
                            </li>
                            <li>
                                <Link href="/demo" className="hover:text-foreground transition-colors">
                                    Live Match Demo
                                </Link>
                            </li>
                            <li>
                                <a href="#security" className="hover:text-foreground transition-colors">
                                    Security & SLA
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Column 2: Developers */}
                    <div>
                        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                            Developers
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <li>
                                <a
                                    href="/v1/docs"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    Swagger UI (/v1/docs)
                                </a>
                            </li>
                            <li>
                                <a href="#developer-hub" className="hover:text-foreground transition-colors">
                                    Interactive SDK
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/thanhnam2811/matching-man/blob/main/docs/api-spec-v1.md"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    OpenAPI 3.1 Spec
                                </a>
                            </li>
                            <li>
                                <a href="#developer-hub" className="hover:text-foreground transition-colors">
                                    Webhook Verification
                                </a>
                            </li>
                            <li>
                                <a href="#developer-hub" className="hover:text-foreground transition-colors">
                                    Ready-Check Guide
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Column 3: Governance & Security */}
                    <div>
                        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                            Governance
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <li>
                                <a href="#security" className="hover:text-foreground transition-colors">
                                    HMAC Signatures
                                </a>
                            </li>
                            <li>
                                <a href="#security" className="hover:text-foreground transition-colors">
                                    Audit Trail (SOC2)
                                </a>
                            </li>
                            <li>
                                <a href="#security" className="hover:text-foreground transition-colors">
                                    Dispute Resolution
                                </a>
                            </li>
                            <li>
                                <a href="#security" className="hover:text-foreground transition-colors">
                                    Rate Limiting
                                </a>
                            </li>
                            <li>
                                <a href="#pricing" className="hover:text-foreground transition-colors">
                                    99.99% Uptime SLA
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Column 4: Community & Company */}
                    <div>
                        <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                            Company
                        </h4>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                            <li>
                                <a
                                    href="https://github.com/thanhnam2811/matching-man"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    GitHub Repository
                                </a>
                            </li>
                            <li>
                                <a
                                    href="mailto:enterprise@matchingman.dev"
                                    className="hover:text-foreground transition-colors"
                                >
                                    Contact Sales
                                </a>
                            </li>
                            <li>
                                <Link href="/login" className="hover:text-foreground transition-colors">
                                    Operator Console
                                </Link>
                            </li>
                            <li>
                                <span className="text-muted-foreground/60">Changelog (v1.4.0)</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t pt-8 text-xs text-muted-foreground sm:flex-row">
                    <span>© 2026 Matching Hub Inc. All rights reserved.</span>
                    <span className="font-mono text-[11px]">
                        Multi-tenant · Slot-based · Internal Elo · HMAC Webhooks
                    </span>
                </div>
            </div>
        </footer>
    );
}
