import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    let user;
    try {
        user = await getCurrentUser();
    } catch {
        redirect("/login");
    }

    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
                <div className="flex h-14 items-center justify-between px-6">
                    <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                        <span className="inline-block size-2 rounded-full bg-success" />
                        Matching Hub
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <LogoutButton />
                    </div>
                </div>
            </header>
            <main className="px-6 py-8">{children}</main>
        </div>
    );
}