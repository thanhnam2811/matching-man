import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_VARIANTS: Record<string, BadgeProps["variant"]> = {
    // match statuses
    created: "secondary",
    pending_acceptance: "warning",
    confirmed: "success",
    declined: "destructive",
    cancelled: "outline",
    in_progress: "warning",
    completed: "success",
    failed: "destructive",
    expired: "outline",
    disputed: "warning",
    // penalty statuses
    active: "destructive",
    revoked: "outline",
    // delivery statuses
    pending: "warning",
    delivered: "success",
    exhausted: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();
    return <Badge variant={STATUS_VARIANTS[normalized] ?? "secondary"}>{normalized.replace(/_/g, " ")}</Badge>;
}
