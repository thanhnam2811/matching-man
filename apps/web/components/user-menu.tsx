"use client";

import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Avatar, initialsFrom } from "@/components/ui/avatar";
import { DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator } from "@/components/ui/dropdown-menu";

export function UserMenu({ email, name }: { email: string; name: string | null }) {
    const router = useRouter();

    async function signOut() {
        await fetch("/api/session", { method: "DELETE" });
        router.replace("/login");
        router.refresh();
    }

    return (
        <DropdownMenu label="Account menu" trigger={<Avatar fallback={initialsFrom(name || email)} />}>
            <DropdownLabel>
                <p className="truncate text-sm font-medium">{name || "Account"}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
            </DropdownLabel>
            <DropdownSeparator />
            <DropdownItem href="/dashboard">
                <LayoutDashboard />
                Dashboard
            </DropdownItem>
            <DropdownItem onSelect={signOut}>
                <LogOut />
                Sign out
            </DropdownItem>
        </DropdownMenu>
    );
}
