"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
    ApiError,
    NetworkError,
    TimeoutError,
    apiFetch,
    createManualPenalty,
    pardonPenalty,
    rejectDispute,
    resolveDispute,
    updateProject,
    type PenaltyReason,
} from "./api";

export type FormState = { error?: string };

function humanize(error: unknown): string {
    if (error instanceof ApiError) {
        // 429/5xx: keep generic wording, a raw backend message isn't user-actionable here.
        if (error.status === 429) return "Too many requests — please slow down and try again.";
        if (error.status >= 500) return `The server encountered an error (${error.status}). Please try again later.`;
        // Everything else (400/403/404/409/...): the API's message is specific and
        // safe to show as-is (e.g. "Project must keep at least one owner").
        return error.message || "Please check the form and try again";
    }
    if (error instanceof NetworkError || error instanceof TimeoutError) {
        return error.message;
    }
    return "Something went wrong";
}

type MemberScope = "organizations" | "projects";

function memberScopeFromForm(formData: FormData): { scope: MemberScope; scopeId: string } {
    const organizationId = String(formData.get("organizationId") ?? "");
    if (organizationId) {
        return { scope: "organizations", scopeId: organizationId };
    }
    return { scope: "projects", scopeId: String(formData.get("projectId") ?? "") };
}

function memberScopePath(scope: MemberScope, scopeId: string): string {
    return scope === "organizations" ? `/dashboard/organizations/${scopeId}` : `/dashboard/projects/${scopeId}`;
}

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
        return { error: "Name is required" };
    }

    let organization: { id: string };
    try {
        organization = await apiFetch<{ id: string }>("/organizations", {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath("/dashboard");
    redirect(`/dashboard/organizations/${organization.id}`);
}

export async function createProject(_prev: FormState, formData: FormData): Promise<FormState> {
    const organizationId = String(formData.get("organizationId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const defaultRegion = String(formData.get("defaultRegion") ?? "").trim() || undefined;

    if (!organizationId || !name || !slug) {
        return { error: "Name and slug are required" };
    }

    let project: { id: string };
    try {
        project = await apiFetch<{ id: string }>("/projects", {
            method: "POST",
            body: JSON.stringify({ name, slug, organizationId, defaultRegion }),
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/organizations/${organizationId}`);
    redirect(`/dashboard/projects/${project.id}`);
}

export type ApiKeyState = { key?: string; error?: string };

export async function createApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
    const projectId = String(formData.get("projectId") ?? "");
    const name = String(formData.get("name") ?? "").trim() || undefined;

    try {
        const created = await apiFetch<{ key: string }>(`/projects/${projectId}/api-keys`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
        revalidatePath(`/dashboard/projects/${projectId}/api-keys`);
        return { key: created.key };
    } catch (error) {
        return { error: humanize(error) };
    }
}

export async function revokeApiKey(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const apiKeyId = String(formData.get("apiKeyId") ?? "");
    await apiFetch(`/projects/${projectId}/api-keys/${apiKeyId}/revoke`, { method: "POST" }).catch(() => undefined);
    revalidatePath(`/dashboard/projects/${projectId}/api-keys`);
}

export async function createWebhook(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const url = String(formData.get("url") ?? "").trim();
    const events = formData.getAll("events").map(String);

    if (!url || events.length === 0) {
        return { error: "A URL and at least one event are required" };
    }

    try {
        await apiFetch(`/projects/${projectId}/webhooks`, {
            method: "POST",
            body: JSON.stringify({ url, events }),
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}/webhooks`);
    redirect(`/dashboard/projects/${projectId}/webhooks`);
}

export async function setWebhookActive(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const webhookId = String(formData.get("webhookId") ?? "");
    const isActive = String(formData.get("isActive") ?? "") === "true";
    await apiFetch(`/projects/${projectId}/webhooks/${webhookId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
    }).catch(() => undefined);
    revalidatePath(`/dashboard/projects/${projectId}/webhooks`);
}

export async function deleteWebhook(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const webhookId = String(formData.get("webhookId") ?? "");
    await apiFetch(`/projects/${projectId}/webhooks/${webhookId}`, { method: "DELETE" }).catch(() => undefined);
    revalidatePath(`/dashboard/projects/${projectId}/webhooks`);
}

export async function createEnvironment(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    if (!name) {
        return { error: "Name is required" };
    }

    try {
        await apiFetch(`/projects/${projectId}/environments`, {
            method: "POST",
            body: JSON.stringify({ name }),
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}`);
    return {};
}

export async function deleteEnvironment(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const environmentId = String(formData.get("environmentId") ?? "");
    await apiFetch(`/projects/${projectId}/environments/${environmentId}`, { method: "DELETE" }).catch(() => undefined);
    revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "MEMBER");

    if (!email) {
        return { error: "Email is required" };
    }

    try {
        await apiFetch(`/${scope}/${scopeId}/members`, {
            method: "POST",
            body: JSON.stringify({ email, role }),
        });
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return { error: "No account with that email — ask them to sign up first" };
        }
        return { error: humanize(error) };
    }

    revalidatePath(memberScopePath(scope, scopeId));
    return {};
}

export async function updateMemberRole(_prev: FormState, formData: FormData): Promise<FormState> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const memberId = String(formData.get("memberId") ?? "");
    const role = String(formData.get("role") ?? "MEMBER");

    try {
        await apiFetch(`/${scope}/${scopeId}/members/${memberId}`, {
            method: "PATCH",
            body: JSON.stringify({ role }),
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(memberScopePath(scope, scopeId));
    return {};
}

export async function removeMember(_prev: FormState, formData: FormData): Promise<FormState> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const memberId = String(formData.get("memberId") ?? "");

    try {
        await apiFetch(`/${scope}/${scopeId}/members/${memberId}`, { method: "DELETE" });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(memberScopePath(scope, scopeId));
    return {};
}

export async function resolveDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const disputeId = String(formData.get("disputeId") ?? "");
    const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();
    const winnerRaw = formData.get("overrideWinnerGroupIndex");
    const overrideWinnerGroupIndex =
        winnerRaw !== null && winnerRaw !== undefined && String(winnerRaw).trim() !== "" ? Number(winnerRaw) : null;

    if (!resolutionNotes) {
        return { error: "Resolution notes are required" };
    }

    try {
        await resolveDispute(projectId, disputeId, {
            overrideWinnerGroupIndex:
                overrideWinnerGroupIndex !== null && !Number.isNaN(overrideWinnerGroupIndex)
                    ? overrideWinnerGroupIndex
                    : null,
            resolutionNotes,
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}/disputes`);
    revalidatePath(`/dashboard/projects/${projectId}/disputes/${disputeId}`);
    return {};
}

export async function rejectDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const disputeId = String(formData.get("disputeId") ?? "");
    const resolutionNotes = String(formData.get("resolutionNotes") ?? "").trim();

    if (!resolutionNotes) {
        return { error: "Resolution notes are required" };
    }

    try {
        await rejectDispute(projectId, disputeId, {
            resolutionNotes,
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}/disputes`);
    revalidatePath(`/dashboard/projects/${projectId}/disputes/${disputeId}`);
    return {};
}

export async function pardonPenaltyAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const penaltyId = String(formData.get("penaltyId") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();

    try {
        await pardonPenalty(projectId, penaltyId, notes || undefined);
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}/penalties`);
    return {};
}

export async function createManualPenaltyAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const playerId = String(formData.get("playerId") ?? "").trim();
    const durationMinutes = Number(formData.get("durationMinutes") ?? 30);
    const reason = String(formData.get("reason") ?? "MANUAL_LOCKOUT") as PenaltyReason;
    const notes = String(formData.get("notes") ?? "").trim();

    if (!playerId) {
        return { error: "Player ID is required" };
    }

    if (Number.isNaN(durationMinutes) || durationMinutes < 1) {
        return { error: "Duration must be at least 1 minute" };
    }

    try {
        await createManualPenalty(projectId, {
            playerId,
            durationSeconds: durationMinutes * 60,
            reason,
            notes: notes || undefined,
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}/penalties`);
    return {};
}

export async function updateProjectPenaltyConfigAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const projectId = String(formData.get("projectId") ?? "");
    const enableDodgePenalty =
        formData.get("enableDodgePenalty") === "true" || formData.get("enableDodgePenalty") === "on";
    const tiersRaw = String(formData.get("penaltyTiers") ?? "180, 900, 3600, 86400");
    const penaltyDecayHours = Number(formData.get("penaltyDecayHours") ?? 24);

    const penaltyTiers = tiersRaw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n) && n > 0);

    try {
        await updateProject(projectId, {
            enableDodgePenalty,
            penaltyTiers: penaltyTiers.length > 0 ? penaltyTiers : [180, 900, 3600, 86400],
            penaltyDecayHours: !Number.isNaN(penaltyDecayHours) && penaltyDecayHours > 0 ? penaltyDecayHours : 24,
        });
    } catch (error) {
        return { error: humanize(error) };
    }

    revalidatePath(`/dashboard/projects/${projectId}`);
    return {};
}
