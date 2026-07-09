"use client";

import { useActionState } from "react";
import { createEnvironment, deleteEnvironment, type FormState } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";

type Environment = {
    id: string;
    name: string;
    isDefault: boolean;
};

const initialState: FormState = {};

export function EnvironmentsManager({ projectId, environments }: { projectId: string; environments: Environment[] }) {
    const [state, action, pending] = useActionState(createEnvironment, initialState);

    return (
        <div className="space-y-4">
            <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <input type="hidden" name="projectId" value={projectId} />
                <Input name="name" placeholder="New environment name" className="flex-1" required />
                <Button type="submit" disabled={pending}>
                    {pending ? "Adding…" : "Add"}
                </Button>
            </form>

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            {environments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No environments.</p>
            ) : (
                <ul className="divide-y">
                    {environments.map((environment) => (
                        <li key={environment.id} className="flex items-center justify-between py-2">
                            <span className="flex items-center gap-2 text-sm">
                                {environment.name}
                                {environment.isDefault ? <Badge variant="secondary">default</Badge> : null}
                            </span>
                            {environment.isDefault ? null : (
                                <form action={deleteEnvironment}>
                                    <input type="hidden" name="projectId" value={projectId} />
                                    <input type="hidden" name="environmentId" value={environment.id} />
                                    <ConfirmButton confirmLabel="Delete environment">Delete</ConfirmButton>
                                </form>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
