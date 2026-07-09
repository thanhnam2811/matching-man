import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { DemoBanner } from "@/components/demo-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

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
                <div className="flex h-14 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-1">
                        <DashboardMobileNav />
                        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                            <span className="inline-block size-2 rounded-full bg-success" />
                            Matching Hub
                        </Link>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeToggle />
                        <UserMenu email={user.email} name={user.name} />
                    </div>
                </div>
            </header>
            {user.demo?.isDemoAccount ? <DemoBanner demo={user.demo} /> : null}
            <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
    );
}
