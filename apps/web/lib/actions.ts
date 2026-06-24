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