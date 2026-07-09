import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Skeleton className="h-9 w-full max-w-sm" />
                </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, i) => (
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
        </div>
    );
}
