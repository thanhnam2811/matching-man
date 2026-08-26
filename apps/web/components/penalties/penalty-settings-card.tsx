"use client";

import * as React from "react";
import { Edit2, ShieldCheck } from "lucide-react";
import { updateProjectPenaltyConfigAction, type FormState } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const initialState: FormState = {};

function formatSeconds(sec: number): string {
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.round(sec / 60)}m`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h`;
    return `${Math.round(sec / 86400)}d`;
}

export function PenaltySettingsCard({
    projectId,
    enableDodgePenalty,
    penaltyTiers,
    penaltyDecayHours,
    canManage,
}: {
    projectId: string;
    enableDodgePenalty?: boolean;
    penaltyTiers?: number[];
    penaltyDecayHours?: number;
    canManage: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const tiers = Array.isArray(penaltyTiers) && penaltyTiers.length > 0 ? penaltyTiers : [180, 900, 3600, 86400];
    const decayHours = penaltyDecayHours ?? 24;
    const isEnabled = enableDodgePenalty ?? false;

    const [state, action, pending] = React.useActionState(async (prev: FormState, formData: FormData) => {
        const res = await updateProjectPenaltyConfigAction(prev, formData);
        if (!res.error) {
            setOpen(false);
        }
        return res;
    }, initialState);

    return (
        <>
            <Card className="min-w-0">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-semibold">Dodge Penalties & Escalation</CardTitle>
                        <CardDescription>
                            Configure cooldown tiers and decay window for match dodges and AFK timeouts.
                        </CardDescription>
                    </div>
                    {canManage ? (
                        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
                            <Edit2 className="h-3.5 w-3.5" />
                            Configure
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Status:</span>
                        {isEnabled ? (
                            <Badge variant="success" className="gap-1 text-[11px]">
                                <ShieldCheck className="h-3 w-3" />
                                Enabled
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[11px]">
                                Disabled
                            </Badge>
                        )}
                    </div>

                    <div>
                        <span className="text-xs font-medium text-muted-foreground">Escalation Ladder:</span>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {tiers.map((tierSeconds, index) => (
                                <React.Fragment key={index}>
                                    <div className="flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 font-mono text-xs shadow-xs">
                                        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                            #{index + 1}
                                        </span>
                                        <span className="font-semibold text-foreground">
                                            {formatSeconds(tierSeconds)}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">({tierSeconds}s)</span>
                                    </div>
                                    {index < tiers.length - 1 ? (
                                        <span className="text-muted-foreground/60 text-xs">→</span>
                                    ) : null}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground border-t pt-3">
                        <span className="font-medium text-muted-foreground">Decay Window: </span>
                        <span className="font-semibold text-foreground">{decayHours} hours</span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            A player’s offense tier steps down or clears completely after {decayHours}h of clean
                            behavior.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <DetailDrawer open={open} onClose={() => setOpen(false)} title="Configure Dodge Penalties">
                <p className="mb-4 text-xs text-muted-foreground">
                    Update penalty escalation ladder and cooldown parameters for this project.
                </p>
                <form action={action} className="space-y-4">
                    <input type="hidden" name="projectId" value={projectId} />

                    {state.error ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                            {state.error}
                        </div>
                    ) : null}

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="enableDodgePenalty"
                            name="enableDodgePenalty"
                            defaultChecked={isEnabled}
                            className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor="enableDodgePenalty" className="text-sm font-medium">
                            Enable Automatic Dodge & AFK Penalties
                        </Label>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="penaltyTiers">Escalation Tiers (Comma-separated Seconds) *</Label>
                        <Input
                            id="penaltyTiers"
                            name="penaltyTiers"
                            defaultValue={tiers.join(", ")}
                            placeholder="180, 900, 3600, 86400"
                            className="font-mono text-sm"
                            required
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Durations in seconds for 1st, 2nd, 3rd, and subsequent offenses (e.g. 180 = 3m, 900 = 15m,
                            3600 = 1h).
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="penaltyDecayHours">Decay Window (Hours) *</Label>
                        <Input
                            id="penaltyDecayHours"
                            name="penaltyDecayHours"
                            type="number"
                            min="1"
                            max="720"
                            defaultValue={decayHours}
                            required
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Number of offense-free hours before a player’s violation count decays.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending} className="gap-1.5">
                            {pending ? <Spinner className="h-4 w-4" /> : null}
                            Save Settings
                        </Button>
                    </div>
                </form>
            </DetailDrawer>
        </>
    );
}
