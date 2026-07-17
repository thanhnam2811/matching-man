"use client";

import { useActionState, useEffect } from "react";
import { type FormState, inviteMember, removeMember, updateMemberRole } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

type Member = {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null };
};

type MemberScope = "organizations" | "projects";

const ROLES = ["OWNER", "ADMIN", "MEMBER"];

const initialState: FormState = {};

// Toasts a form action's returned error, if any — for actions rendered as plain
// buttons (no inline error text) so a rejected mutation (e.g. "must keep at
// least one owner") isn't silently swallowed.
function useErrorToast(error: string | undefined, title: string) {
    useEffect(() => {
        if (error) {
            toast({ title, description: error, variant: "destructive" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-toast when the error itself changes
    }, [error]);
}

function MemberRow({
    member,
    scopeFieldName,
    scopeId,
    canManage,
}: {
    member: Member;
    scopeFieldName: "organizationId" | "projectId";
    scopeId: string;
    canManage: boolean;
}) {
    const [roleState, roleAction] = useActionState(updateMemberRole, initialState);
    const [removeState, removeAction] = useActionState(removeMember, initialState);
    useErrorToast(roleState.error, "Couldn't change role");
    useErrorToast(removeState.error, "Couldn't remove member");

    return (
        <li className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
                <p className="truncate text-sm">{member.user.name ?? member.user.email}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{member.user.email}</p>
            </div>
            {canManage ? (
                <div className="flex shrink-0 items-center gap-1">
                    <form action={roleAction} className="flex items-center gap-1">
                        <input type="hidden" name={scopeFieldName} value={scopeId} />
                        <input type="hidden" name="memberId" value={member.id} />
                        <Select name="role" defaultValue={member.role}>
                            <SelectTrigger className="w-28" aria-label="Member role">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {ROLES.map((role) => (
                                    <SelectItem key={role} value={role}>
                                        {role.toLowerCase()}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="submit" variant="ghost" size="sm">
                            Save
                        </Button>
                    </form>
                    <form action={removeAction}>
                        <input type="hidden" name={scopeFieldName} value={scopeId} />
                        <input type="hidden" name="memberId" value={member.id} />
                        <ConfirmButton confirmLabel="Remove member">Remove</ConfirmButton>
                    </form>
                </div>
            ) : (
                <Badge variant="secondary">{member.role.toLowerCase()}</Badge>
            )}
        </li>
    );
}

export function MembersManager({
    scope,
    scopeId,
    members,
    canManage,
}: {
    scope: MemberScope;
    scopeId: string;
    members: Member[];
    canManage: boolean;
}) {
    const [state, action, pending] = useActionState(inviteMember, initialState);
    const scopeFieldName = scope === "organizations" ? "organizationId" : "projectId";

    return (
        <div className="space-y-4">
            {canManage ? (
                <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input type="hidden" name={scopeFieldName} value={scopeId} />
                    <Input name="email" type="email" placeholder="teammate@example.com" className="flex-1" required />
                    <Select name="role" defaultValue="MEMBER">
                        <SelectTrigger className="w-28" aria-label="Role">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                    {role.toLowerCase()}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="submit" disabled={pending}>
                        {pending ? "Inviting…" : "Invite"}
                    </Button>
                </form>
            ) : null}

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <ul className="divide-y">
                {members.map((member) => (
                    <MemberRow
                        key={member.id}
                        member={member}
                        scopeFieldName={scopeFieldName}
                        scopeId={scopeId}
                        canManage={canManage}
                    />
                ))}
            </ul>
        </div>
    );
}
