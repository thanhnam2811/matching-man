"use client";

import * as React from "react";
import { PlusCircle, ShieldAlert } from "lucide-react";
import { createManualPenaltyAction, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const initialState: FormState = {};

export function CreatePenaltyDialog({ projectId }: { projectId: string }) {
    const [open, setOpen] = React.useState(false);
    const [state, action, pending] = React.useActionState(async (prev: FormState, formData: FormData) => {
        const res = await createManualPenaltyAction(prev, formData);
        if (!res.error) {
            setOpen(false);
        }
        return res;
    }, initialState);

    return (
        <>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
                <PlusCircle className="h-4 w-4" />
                Issue Penalty
            </Button>

            <DetailDrawer open={open} onClose={() => setOpen(false)} title="Issue Player Penalty">
                <p className="mb-4 text-xs text-muted-foreground">
                    Manually lock out a player from queueing across all game modes in this project.
                </p>
                <form action={action} className="space-y-4">
                    <input type="hidden" name="projectId" value={projectId} />

                    {state.error ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                            {state.error}
                        </div>
                    ) : null}

                    <div className="space-y-1.5">
                        <Label htmlFor="playerId">Player ID *</Label>
                        <Input
                            id="playerId"
                            name="playerId"
                            required
                            placeholder="e.g. user_abc123"
                            className="font-mono text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="durationMinutes">Lockout Duration (Minutes) *</Label>
                        <Input
                            id="durationMinutes"
                            name="durationMinutes"
                            type="number"
                            min="1"
                            max="43200"
                            defaultValue="30"
                            required
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Common presets: 5 (warning), 30 (standard), 60 (extended), 1440 (24 hours).
                        </p>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reason">Reason</Label>
                        <select
                            id="reason"
                            name="reason"
                            defaultValue="MANUAL_LOCKOUT"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="MANUAL_LOCKOUT">Manual Operator Lockout</option>
                            <option value="DODGE">Queue / Match Dodge</option>
                            <option value="AFK_TIMEOUT">Ready Check AFK Timeout</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Notes / Rationale</Label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Reason for penalty..."
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" disabled={pending} className="gap-1.5">
                            {pending ? <Spinner className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                            Apply Lockout
                        </Button>
                    </div>
                </form>
            </DetailDrawer>
        </>
    );
}
