"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
    const router = useRouter();

    async function onLogout() {
        await fetch("/api/session", { method: "DELETE" });
        router.replace("/login");
        router.refresh();
    }

    return (
        <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="size-4" />
            Sign out
        </Button>
    );
}