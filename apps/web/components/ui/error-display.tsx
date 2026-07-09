"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, NetworkError, TimeoutError } from "@/lib/api-errors";

export function parseError(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 404) return "The requested resource was not found.";
        if (error.status === 403) return "You do not have permission to view this.";
        if (error.status === 429) return "Too many requests — please slow down and try again.";
        if (error.status >= 500) return `The server encountered an error (${error.status}). Please try again later.`;
        return error.message || "Something went wrong.";
    }
    if (error instanceof NetworkError || error instanceof TimeoutError) {
        return error.message;
    }

    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";

    if (/fetch failed|ECONNREFUSED|network/i.test(message)) {
        return "Unable to reach the server. Check your connection and try again.";
    }
    if (/timeout|aborted/i.test(message)) {
        return "The server did not respond in time. Please try again.";
    }

    return "Something went wrong. Please try again.";
}

export function ErrorDisplay({
    title = "Something went wrong",
    message,
    retry,
    backHref,
    backLabel = "Go back",
}: {
    title?: string;
    message: string;
    retry?: () => void;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <Card className="border-destructive/40">
            <CardHeader>
                <div className="flex size-9 items-center justify-center rounded-md border border-destructive/40 bg-destructive/5">
                    <AlertTriangle className="size-4 text-destructive" />
                </div>
                <CardTitle className="pt-2 text-base">{title}</CardTitle>
                <CardDescription>{message}</CardDescription>
            </CardHeader>
            {retry || backHref ? (
                <CardContent className="flex gap-2">
                    {retry ? (
                        <Button variant="outline" size="sm" onClick={retry}>
                            Try again
                        </Button>
                    ) : null}
                    {backHref ? (
                        <Link href={backHref}>
                            <Button variant="ghost" size="sm">
                                {backLabel}
                            </Button>
                        </Link>
                    ) : null}
                </CardContent>
            ) : null}
        </Card>
    );
}
