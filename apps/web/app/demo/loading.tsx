import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DemoLoading() {
    return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
            <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="size-3" />
                Home
            </Link>
            <Skeleton className="mt-4 h-7 w-64" />
            <Skeleton className="mt-2 h-4 w-full max-w-xl" />

            <div className="mt-8 space-y-6">
                <Card>
                    <CardContent className="flex flex-col gap-4 pt-6">
                        <Skeleton className="h-8 w-64" />
                        <Skeleton className="h-9 w-full max-w-md" />
                    </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <Card key={i}>
                            <CardHeader>
                                <Skeleton className="h-5 w-32" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    );
}
