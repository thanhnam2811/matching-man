import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationLoading() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-3 w-24" />
            </div>

            <Card>
                <CardHeader className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-9 w-full max-w-sm" />
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-3 w-20" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-3 w-40" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
