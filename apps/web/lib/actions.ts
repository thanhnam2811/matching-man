"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, apiFetch } from "./api";

export type FormState = { error?: string };

function humanize(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 409) return "That name or slug is already taken";
        if (error.status === 403) return "You do not have permission to do that";
        if (error.status === 400) return "Please check the form and try again";
    }
    return "Something went wrong";
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

    revalidatePath("/");
    redirect(`/organizations/${organization.id}`);
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

    revalidatePath(`/organizations/${organizationId}`);
    redirect(`/projects/${project.id}`);
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
        revalidatePath(`/projects/${projectId}`);
        return { key: created.key };
    } catch (error) {
        return { error: humanize(error) };
    }
}

export async function revokeApiKey(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const apiKeyId = String(formData.get("apiKeyId") ?? "");
    await apiFetch(`/projects/${projectId}/api-keys/${apiKeyId}/revoke`, { method: "POST" }).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
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

    revalidatePath(`/projects/${projectId}`);
    return {};
}

export async function setWebhookActive(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const webhookId = String(formData.get("webhookId") ?? "");
    const isActive = String(formData.get("isActive") ?? "") === "true";
    await apiFetch(`/projects/${projectId}/webhooks/${webhookId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
    }).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
}

export async function deleteWebhook(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const webhookId = String(formData.get("webhookId") ?? "");
    await apiFetch(`/projects/${projectId}/webhooks/${webhookId}`, { method: "DELETE" }).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
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

    revalidatePath(`/projects/${projectId}`);
    return {};
}

export async function deleteEnvironment(formData: FormData): Promise<void> {
    const projectId = String(formData.get("projectId") ?? "");
    const environmentId = String(formData.get("environmentId") ?? "");
    await apiFetch(`/projects/${projectId}/environments/${environmentId}`, { method: "DELETE" }).catch(() => undefined);
    revalidatePath(`/projects/${projectId}`);
}