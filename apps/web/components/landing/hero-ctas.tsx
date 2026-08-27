"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export function HeroCtas() {
    const session = useSession();
    const isAuthenticated = session.status === "authenticated";

    return (
        <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={isAuthenticated ? "/dashboard" : "/register"}>
                <Button size="lg" className="shadow-xs">
                    {isAuthenticated ? "Go to Dashboard" : "Start free"}
                    <ArrowRight className="size-4" />
                </Button>
            </Link>
            <Link href="/demo">
                <Button size="lg" variant="outline">
                    <Play className="size-3.5 text-success" />
                    Try the live demo
                </Button>
            </Link>
        </div>
    );
}
