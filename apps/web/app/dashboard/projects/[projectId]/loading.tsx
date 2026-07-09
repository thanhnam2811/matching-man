import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-3 w-64" />
            </div>

            <div className="flex gap-4 border-b pb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-16" />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-3 w-20" />
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </CardContent>
                    </Card>
                ))}
                <Card className="lg:col-span-2">
                    <CardHeader className="space-y-2">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-3 w-16" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
