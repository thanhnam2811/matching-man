import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLUMNS = 6;
const ROWS = 5;

export default function MatchesLoading() {
    return (
        <div className="space-y-4">
            <Card className="p-0">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {Array.from({ length: COLUMNS }).map((_, i) => (
                                    <TableHead key={i}>
                                        <Skeleton className="h-4 w-16" />
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from({ length: ROWS }).map((_, row) => (
                                <TableRow key={row}>
                                    {Array.from({ length: COLUMNS }).map((__, col) => (
                                        <TableCell key={col}>
                                            <Skeleton className="h-4 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                </div>
            </div>
        </div>
    );
}
