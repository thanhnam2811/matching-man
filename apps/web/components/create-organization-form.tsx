"use client";

import { useActionState } from "react";
import { createOrganization, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: FormState = {};

export function CreateOrganizationForm() {
    const [state, action, pending] = useActionState(createOrganization, initialState);

    return (
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
                <Input name="name" placeholder="New organization name" required />
                {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
            </div>
            <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create organization"}
            </Button>
        </form>
    );
}
