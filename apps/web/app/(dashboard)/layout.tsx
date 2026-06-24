import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen">
            <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
                <div className="flex h-14 items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <span className="inline-block size-2 rounded-full bg-success" />
                        Matching Hub
                    </Link>
                    <LogoutButton />
                </div>
            </header>
            <main className="px-6 py-8">{children}</main>
        </div>
    );
}