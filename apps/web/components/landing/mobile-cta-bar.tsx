"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Sticky bottom call-to-action shown only to logged-out visitors on small
// screens, where the header CTAs scroll out of view. Hidden on sm+ and once the
// visitor is authenticated.
export function MobileCtaBar() {
    const [anonymous, setAnonymous] = React.useState<boolean | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        fetch("/api/session/me", { cache: "no-store" })
            .then((response) => response.json())
            .then((data: { authenticated?: boolean }) => {
                if (!cancelled) setAnonymous(!data.authenticated);
            })
            .catch(() => {
                if (!cancelled) setAnonymous(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!anonymous) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
            <div className="flex items-center gap-2">
                <Link href="/demo" className="shrink-0">
                    <Button variant="outline" size="sm">
                        Demo
                    </Button>
                </Link>
                <Link href="/register" className="flex-1">
                    <Button size="sm" className="w-full">
                        Start free
                        <ArrowRight className="size-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
