import { apiFetch, type Paginated, type RatingHistoryEntry } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatDateTime } from "@/lib/utils";

const LIMIT = 20;

export default async function RatingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const result = await apiFetch<Paginated<RatingHistoryEntry>>(
        `/projects/${projectId}/rating-history?limit=${LIMIT}&offset=${offset}`,
    );

    return (
        <div className="space-y-4">
            <Card className="p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">
                            No rating history. Internal Elo must be enabled for a game mode.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Player</TableHead>
                                    <TableHead>Game mode</TableHead>
                                    <TableHead className="text-right">Before</TableHead>
                                    <TableHead className="text-right">After</TableHead>
                                    <TableHead className="text-right">Δ</TableHead>
                                    <TableHead>When</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono text-xs">
                                            {entry.ratingProfile.playerId}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {entry.ratingProfile.gameModeId}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{entry.ratingBefore}</TableCell>
                                        <TableCell className="text-right font-mono">{entry.ratingAfter}</TableCell>
                                        <TableCell
                                            className={cn(
                                                "text-right font-mono",
                                                entry.delta > 0 && "text-success",
                                                entry.delta < 0 && "text-destructive",
                                            )}
                                        >
                                            {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(entry.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/ratings`}
                offset={offset}
                limit={LIMIT}
                total={result.total}
            />
        </div>
    );
}