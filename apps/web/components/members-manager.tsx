"use client";

import { useActionState } from "react";
import { type FormState, inviteMember, removeMember, updateMemberRole } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";

type Member = {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null };
};

const ROLES = ["OWNER", "ADMIN", "MEMBER"];
const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const initialState: FormState = {};

export function MembersManager({
    organizationId,
    members,
    canManage,
}: {
    organizationId: string;
    members: Member[];
    canManage: boolean;
}) {
    const [state, action, pending] = useActionState(inviteMember, initialState);

    return (
        <div className="space-y-4">
            {canManage ? (
                <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <Input name="email" type="email" placeholder="teammate@example.com" className="flex-1" required />
                    <select name="role" defaultValue="MEMBER" className={selectClass} aria-label="Role">
                        {ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.toLowerCase()}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" disabled={pending}>
                        {pending ? "Inviting…" : "Invite"}
                    </Button>
                </form>
            ) : null}

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <ul className="divide-y">
                {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm">{member.user.name ?? member.user.email}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                        {canManage ? (
                            <div className="flex shrink-0 items-center gap-1">
                                <form action={updateMemberRole} className="flex items-center gap-1">
                                    <input type="hidden" name="organizationId" value={organizationId} />
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <select
                                        name="role"
                                        defaultValue={member.role}
                                        className={selectClass}
                                        aria-label="Member role"
                                    >
                                        {ROLES.map((role) => (
                                            <option key={role} value={role}>
                                                {role.toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                    <Button type="submit" variant="ghost" size="sm">
                                        Save
                                    </Button>
                                </form>
                                <form action={removeMember}>
                                    <input type="hidden" name="organizationId" value={organizationId} />
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <ConfirmButton confirmLabel="Remove member">Remove</ConfirmButton>
                                </form>
                            </div>
                        ) : (
                            <Badge variant="secondary">{member.role.toLowerCase()}</Badge>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
