import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const POINTS = [
    "Team-based engine — solo to N-player parties",
    "Internal Elo or bring-your-own ratings, per mode",
    "Signed, retried webhooks with a full delivery log",
];

// Split-screen auth layout: a brand/marketing panel on the left (lg+) and the
// form on the right. On mobile the panel collapses and only the form shows.
export function AuthShell({ children }: { children: React.ReactNode }) {
    return (
        <main className="grid min-h-screen lg:grid-cols-2">
            <div className="relative hidden overflow-hidden border-r bg-muted/20 lg:flex lg:flex-col lg:justify-between lg:p-10">
                <div className="pointer-events-none absolute inset-0 bg-grid [background-size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />

                <Link href="/" className="relative flex items-center gap-2 font-semibold">
                    <span className="inline-block size-2 rounded-full bg-success" />
                    Matching Hub
                </Link>

                <div className="relative space-y-6">
                    <h2 className="max-w-sm text-balance text-2xl font-semibold tracking-tight">
                        Matchmaking infrastructure for your game
                    </h2>
                    <ul className="space-y-3 text-sm text-muted-foreground">
                        {POINTS.map((point) => (
                            <li key={point} className="flex items-start gap-2">
                                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="relative text-xs text-muted-foreground">
                    Multi-tenant · slot-based matches · internal Elo or external ratings
                </p>
            </div>

            <div className="relative flex items-center justify-center p-4">
                <Link
                    href="/"
                    className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-3" />
                    Back to home
                </Link>
                <div className="absolute right-4 top-4">
                    <ThemeToggle />
                </div>
                <div className="w-full max-w-sm">{children}</div>
            </div>
        </main>
    );
}
