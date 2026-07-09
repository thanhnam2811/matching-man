import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RegisterLoading() {
    return (
        <main className="relative flex min-h-screen items-center justify-center p-4">
            <Link
                href="/"
                className="absolute left-4 top-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-3" />
                Back to home
            </Link>
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-56" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-12" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <Skeleton className="h-9 w-full" />
                </CardContent>
            </Card>
        </main>
    );
}
