import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { DisputeStatus } from "@/lib/api";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
    open: "warning",
    resolved: "success",
    rejected: "destructive",
};

export function DisputeStatusBadge({ status }: { status: DisputeStatus | string }) {
    const normalized = status.toLowerCase();
    const variant = STATUS_VARIANTS[normalized] ?? "secondary";

    return <Badge variant={variant}>{normalized.toUpperCase()}</Badge>;
}
