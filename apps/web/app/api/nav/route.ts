import { apiFetch, type NavOrganization, type OrganizationDetail, type OrganizationSummary } from "@/lib/api";
import { proxyJson } from "@/lib/proxy";

// Navigation index for the command palette: every organization the user can
// see, with its projects.
export async function GET() {
    return proxyJson<NavOrganization[]>(async () => {
        const organizations = await apiFetch<OrganizationSummary[]>("/organizations");
        const details = await Promise.all(
            organizations.map((org) => apiFetch<OrganizationDetail>(`/organizations/${org.id}`)),
        );
        return details.map((org) => ({
            id: org.id,
            name: org.name,
            projects: org.projects.map((project) => ({ id: project.id, name: project.name })),
        }));
    });
}
