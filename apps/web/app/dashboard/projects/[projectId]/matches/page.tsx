import { apiFetch, type MatchSummary, type Paginated } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

const LIMIT = 20;

export default async function MatchesPage({
    params,
    searchParams,
}: {
    params: Promise<{ projectId: string }>;
    searchParams: Promise<{ offset?: string }>;
}) {
    const { projectId } = await params;
    const { offset: offsetParam } = await searchParams;
    const offset = Math.max(Number(offsetParam) || 0, 0);

    const result = await apiFetch<Paginated<MatchSummary>>(
        `/projects/${projectId}/matches?limit=${LIMIT}&offset=${offset}`,
    );

    return (
        <div className="space-y-4">
            <Card className="p-0">
                <CardContent className="p-0">
                    {result.data.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">No matches.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Game mode</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Environment</TableHead>
                                    <TableHead>Winner</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.map((match) => (
                                    <TableRow key={match.id}>
                                        <TableCell className="font-mono text-xs">{match.id}</TableCell>
                                        <TableCell className="font-mono text-xs">{match.gameModeId}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={match.status} />
                                        </TableCell>
                                        <TableCell>{match.environment}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {match.result?.winnerGroupIndex != null
                                                ? `group ${match.result.winnerGroupIndex}`
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {formatDateTime(match.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Pagination
                basePath={`/dashboard/projects/${projectId}/matches`}
                offset={offset}
                limit={LIMIT}
                total={result.total}
            />
        </div>
    );
}