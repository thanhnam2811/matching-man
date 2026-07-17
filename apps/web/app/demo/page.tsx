import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isDemoEnabled } from "@/lib/demo";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBoard } from "@/components/demo-board";

// Matches the seeded skill-1v1 game mode (apps/api/src/demo/demo.constants.ts).
const SKILL_WINDOW = { initial: 50, intervalSeconds: 3, step: 100 };

export default async function DemoPage() {
    const enabled = await isDemoEnabled();

    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
            <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-3" />
                Home
            </Link>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Live matchmaking demo</h1>
            <p className="text-sm text-muted-foreground">
                Add players and watch the real engine pair them. Each add hits a live demo project — skill mode pairs
                within an expanding rating window, casual mode pairs anyone.
            </p>

            <div className="mt-8">
                {enabled ? (
                    <DemoBoard skillWindow={SKILL_WINDOW} />
                ) : (
                    <Card>
                        <CardContent className="py-12 text-center text-sm text-muted-foreground">
                            The demo is temporarily unavailable — the API may be waking up or unreachable. Try
                            refreshing in a moment.
                        </CardContent>
                    </Card>
                )}
            </div>
        </main>
    );
}
