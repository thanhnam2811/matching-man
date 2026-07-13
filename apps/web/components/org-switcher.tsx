"use client";

import { usePathname } from "next/navigation";
import { Building2, Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import type { OrganizationMembership } from "@/lib/api";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/dropdown-menu";

// Tenant switcher: jump between organizations without going back to the index.
// The active org is derived from the URL, so it only highlights on org pages.
export function OrgSwitcher({ organizations }: { organizations: OrganizationMembership[] }) {
    const pathname = usePathname();
    const activeOrg = organizations.find((org) => pathname.startsWith(`/dashboard/organizations/${org.id}`));

    return (
        <DropdownMenu
            block
            align="start"
            label="Switch organization"
            className="w-full"
            trigger={
                <span className="flex w-full items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-sm shadow-sm transition-colors hover:bg-accent">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        <Building2 className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left font-medium">
                        {activeOrg?.name ?? "All organizations"}
                    </span>
                    <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                </span>
            }
        >
            <DropdownLabel>
                <p className="text-xs font-medium text-muted-foreground">Organizations</p>
            </DropdownLabel>
            {organizations.map((org) => (
                <DropdownItem key={org.id} href={`/dashboard/organizations/${org.id}`}>
                    <span className="min-w-0 flex-1 truncate">{org.name}</span>
                    {activeOrg?.id === org.id ? <Check className="text-primary" /> : null}
                </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem href="/dashboard">
                <LayoutGrid />
                All organizations
            </DropdownItem>
        </DropdownMenu>
    );
}
