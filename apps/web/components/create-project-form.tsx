"use client";

import { useActionState } from "react";
import { createProject, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: FormState = {};

export function CreateProjectForm({ organizationId }: { organizationId: string }) {
    const [state, action, pending] = useActionState(createProject, initialState);

    return (
        <form action={action} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="organizationId" value={organizationId} />

            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Arena" required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" placeholder="arena" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
            </div>

            <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="defaultRegion">Default region (optional)</Label>
                <Input id="defaultRegion" name="defaultRegion" placeholder="ap-southeast-1" />
            </div>

            {state.error ? <p className="text-sm text-destructive sm:col-span-2">{state.error}</p> : null}

            <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create project"}
                </Button>
            </div>
        </form>
    );
}
