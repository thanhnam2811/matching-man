"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { pardonPenaltyAction, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Spinner } from "@/components/ui/spinner";

const initialState: FormState = {};

export function PardonPenaltyButton({
    projectId,
    penaltyId,
    playerId,
}: {
    projectId: string;
    penaltyId: string;
    playerId: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [state, action, pending] = React.useActionState(async (prev: FormState, formData: FormData) => {
        const res = await pardonPenaltyAction(prev, formData);
        if (!res.error) {
            setOpen(false);
        }
        return res;
    }, initialState);

    return (
        <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="h-7 text-xs">
                Pardon
            </Button>

            <DetailDrawer open={open} onClose={() => setOpen(false)} title="Pardon Player Penalty">
                <p className="mb-4 text-xs text-muted-foreground">
                    Lift cooldown for player <span className="font-mono font-medium text-foreground">{playerId}</span>{" "}
                    immediately.
                </p>
                <form action={action} className="space-y-4">
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="penaltyId" value={penaltyId} />

                    {state.error ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                            {state.error}
                        </div>
                    ) : null}

                    <div className="space-y-1.5">
                        <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
                            Pardon Reason / Operator Notes
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            rows={3}
                            placeholder="Why is this penalty being revoked?"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="default" disabled={pending} className="gap-1.5">
                            {pending ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            Revoke Penalty
                        </Button>
                    </div>
                </form>
            </DetailDrawer>
        </>
    );
}
