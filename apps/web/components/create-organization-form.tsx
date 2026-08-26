"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createOrganization, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

export function CreateOrganizationForm({ cancelHref = "/dashboard" }: { cancelHref?: string }) {
    const [state, action, pending] = useActionState(createOrganization, initialState);

    return (
        <form action={action} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Acme Corp" required />
                {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
            </div>
            <div className="flex items-center gap-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create organization"}
                </Button>
                {cancelHref ? (
                    <Button variant="ghost" asChild type="button">
                        <Link href={cancelHref}>Cancel</Link>
                    </Button>
                ) : null}
            </div>
        </form>
    );
}
