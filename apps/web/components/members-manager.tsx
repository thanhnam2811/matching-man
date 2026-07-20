"use client";

import { useActionState, useEffect, useState } from "react";
import useSWR from "swr";
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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECK_DEBOUNCE_MS = 400;

const initialState: FormState = {};

// Debounced "is this email a registered account?" hint for the organization
// invite field — informational only, the API still enforces it on submit.
function OrganizationInviteEmailField({ organizationId }: { organizationId: string }) {
    const [email, setEmail] = useState("");
    const [debounced, setDebounced] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(email.trim().toLowerCase()), CHECK_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [email]);

    const normalized = email.trim().toLowerCase();
    const looksLikeEmail = EMAIL_PATTERN.test(debounced);
    const { data, isLoading, error } = useSWR<{ exists: boolean }>(
        looksLikeEmail
            ? `/api/organizations/${organizationId}/members/check-email?email=${encodeURIComponent(debounced)}`
            : null,
    );
    const checking = looksLikeEmail && (debounced !== normalized || isLoading);

    return (
        <div className="flex-1 space-y-1">
            <Input
                name="email"
                type="email"
                placeholder="teammate@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />
            {looksLikeEmail && !error ? (
                <p className="text-xs text-muted-foreground">
                    {checking ? "Checking…" : data?.exists ? "✓ Registered user" : "No account with this email yet"}
                </p>
            ) : null}
        </div>
    );
}

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
    orgMembers = [],
}: {
    scope: MemberScope;
    scopeId: string;
    members: Member[];
    canManage: boolean;
    // Only used for scope="projects": the project's organization members, to
    // populate the invite picker (can't invite someone outside the org — see
    // ProjectMembersService.create's org-membership check).
    orgMembers?: Member[];
}) {
    const [state, action, pending] = useActionState(inviteMember, initialState);
    const scopeFieldName = scope === "organizations" ? "organizationId" : "projectId";
    const eligibleOrgMembers =
        scope === "projects" ? orgMembers.filter((om) => !members.some((m) => m.user.id === om.user.id)) : [];

    return (
        <div className="space-y-4">
            {canManage && scope === "projects" && eligibleOrgMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Every organization member already has access to this project. Add someone to the organization first
                    to invite them here.
                </p>
            ) : canManage ? (
                <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input type="hidden" name={scopeFieldName} value={scopeId} />
                    {scope === "projects" ? (
                        <Select name="email" required>
                            <SelectTrigger className="flex-1" aria-label="Organization member">
                                <SelectValue placeholder="Choose an org member…" />
                            </SelectTrigger>
                            <SelectContent>
                                {eligibleOrgMembers.map((om) => (
                                    <SelectItem key={om.user.id} value={om.user.email}>
                                        {om.user.name ?? om.user.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <OrganizationInviteEmailField organizationId={scopeId} />
                    )}
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
