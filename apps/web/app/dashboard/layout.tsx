import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { CommandPalette } from "@/components/command-palette";
import { DashboardMobileNav } from "@/components/dashboard-mobile-nav";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
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
        <div className="flex min-h-screen">
            <DashboardSidebar organizations={user.organizations} />

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
                    <div className="flex h-14 items-center justify-between px-4 md:px-6">
                        <div className="flex items-center gap-1 lg:hidden">
                            <DashboardMobileNav />
                            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
                                <BrandMark />
                                Matching Hub
                            </Link>
                        </div>
                        <div className="ml-auto flex items-center gap-1.5">
                            <CommandPalette />
                            <ThemeToggle />
                            <UserMenu email={user.email} name={user.name} />
                        </div>
                    </div>
                </header>
                {user.demo?.isDemoAccount ? <DemoBanner demo={user.demo} /> : null}
                <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
            </div>
        </div>
    );
}
