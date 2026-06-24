import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
    // match statuses
    created: "secondary",
    in_progress: "warning",
    completed: "success",
    failed: "destructive",
    expired: "outline",
    disputed: "warning",
    // delivery statuses
    pending: "warning",
    delivered: "success",
    exhausted: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();
    return <Badge variant={STATUS_VARIANTS[normalized] ?? "secondary"}>{normalized.replace(/_/g, " ")}</Badge>;
}