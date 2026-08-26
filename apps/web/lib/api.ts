import { cookies, headers } from "next/headers";
import { ApiError, NetworkError, TimeoutError } from "./api-errors";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/v1";
export const TOKEN_COOKIE = "dashboard_token";

export { ApiError, NetworkError, TimeoutError } from "./api-errors";

/**
 * Server-side fetch against the NestJS API. Reads the dashboard admin token
 * from the httpOnly cookie so it never reaches the browser.
 */
// The API's GlobalExceptionFilter (apps/api/src/common/filters/global-exception.filter.ts)
// wraps every error response as `{ success: false, error: { statusCode, code, message,
// details? }, requestId, timestamp, path }`. Pull the real message out of that envelope
// instead of surfacing the raw JSON body to callers.
function extractErrorMessage(raw: string): string {
    try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        return parsed.error?.message || raw;
    } catch {
        return raw;
    }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value;
    const reqHeaders = await headers().catch(() => null);
    const clientUserAgent = reqHeaders?.get("user-agent");
    const clientForwardedFor = reqHeaders?.get("x-forwarded-for") || reqHeaders?.get("x-real-ip");

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(clientUserAgent
                    ? { "User-Agent": clientUserAgent, "X-Forwarded-User-Agent": clientUserAgent }
                    : {}),
                ...(clientForwardedFor ? { "X-Forwarded-For": clientForwardedFor } : {}),
                ...init?.headers,
            },
            cache: "no-store",
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new TimeoutError();
        }
        if (error instanceof TypeError) {
            throw new NetworkError();
        }
        throw error;
    }

    if (!response.ok) {
        const raw = await response.text().catch(() => "");
        throw new ApiError(response.status, extractErrorMessage(raw) || response.statusText);
    }

    return response.json() as Promise<T>;
}

export type SessionLoginResult = { ok: true } | { ok: false; status: number };

/**
 * Logs into the NestJS API and, on success, stores the returned token in the
 * httpOnly `dashboard_token` cookie. Shared by the normal email/password login
 * route and the one-click demo login route. Returns `{ ok: false, status: 401 }`
 * when the credentials are rejected so callers can map it to their own response.
 */
export async function loginAndSetSessionCookie(email: string, password: string): Promise<SessionLoginResult> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
    });

    if (!response.ok) {
        return { ok: false, status: 401 };
    }

    const { token } = (await response.json()) as { token: string };

    (await cookies()).set(TOKEN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 12,
    });

    return { ok: true };
}

export type Paginated<T> = {
    data: T[];
    total: number;
};

export type OrganizationMembership = {
    id: string;
    name: string;
    slug: string;
    role: string;
};

export type DemoStatus = {
    isDemoAccount: boolean;
    resetIntervalMinutes: number;
    lastResetAt: string | null;
    nextResetAt: string | null;
};

export type CurrentUser = {
    id: string;
    email: string;
    name: string | null;
    organizations: OrganizationMembership[];
    demo?: DemoStatus | null;
};

export function getCurrentUser() {
    return apiFetch<CurrentUser>("/auth/me");
}

export type Project = {
    id: string;
    name: string;
    slug: string;
    defaultRegion: string | null;
    enableDodgePenalty?: boolean;
    penaltyTiers?: number[];
    penaltyDecayHours?: number;
    createdAt: string;
};

export type ProjectMember = {
    id: string;
    role: string;
    createdAt: string;
    user: { id: string; email: string; name: string | null };
};

export type ProjectDetail = {
    id: string;
    name: string;
    slug: string;
    defaultRegion: string | null;
    enableDodgePenalty?: boolean;
    penaltyTiers?: number[];
    penaltyDecayHours?: number;
    createdAt: string;
    updatedAt: string;
    organization: { id: string; name: string; slug: string };
    members: ProjectMember[];
};

export type OrganizationSummary = {
    id: string;
    name: string;
    slug: string;
    projectCount: number;
    memberCount: number;
    createdAt: string;
};

export type OrganizationDetail = {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    projects: Project[];
};

export type OrganizationMember = {
    id: string;
    role: string;
    createdAt: string;
    user: { id: string; email: string; name: string | null };
};

export type Pool = {
    id: string;
    gameModeId: string;
    environment: string;
    regionKey: string;
    queuedCount: number;
    createdAt: string;
};

export type MatchSummary = {
    id: string;
    gameModeId: string;
    status: string;
    environment: string;
    region: string;
    requiredSlots: number;
    groupCount: number;
    ratingMode: string;
    createdAt: string;
    result: { winnerGroupIndex: number | null; endedAt: string } | null;
};

export type Delivery = {
    id: string;
    webhookEndpointId: string;
    eventType: string;
    status: string;
    attemptCount: number;
    lastAttemptAt: string | null;
    lastResponseCode: number | null;
    lastError: string | null;
    nextRetryAt: string | null;
    exhaustedAt: string | null;
    createdAt: string;
};

export type RatingHistoryEntry = {
    id: string;
    matchId: string;
    ratingBefore: number;
    ratingAfter: number;
    delta: number;
    createdAt: string;
    ratingProfile: { playerId: string; gameModeId: string };
};

// Shape served by the web app's own /api/nav route (command palette index).
export type NavOrganization = {
    id: string;
    name: string;
    projects: { id: string; name: string }[];
};

export type Environment = {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
};

export type ApiKey = {
    id: string;
    name: string;
    keyPrefix: string;
    lastFour: string;
    isRevoked: boolean;
    revokedAt: string | null;
    createdAt: string;
};

export type Webhook = {
    id: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: string;
};

export type DisputeStatus = "OPEN" | "RESOLVED" | "REJECTED";

export type MatchDisputeSummary = {
    id: string;
    projectId: string;
    matchId: string;
    claimantTeamId: string | null;
    reason: string;
    evidence: unknown;
    status: DisputeStatus;
    overrideWinnerGroupIndex: number | null;
    resolvedByUserId: string | null;
    resolvedAt: string | null;
    resolutionNotes: string | null;
    createdAt: string;
    updatedAt: string;
    match: {
        id: string;
        gameModeId: string;
        environment: string;
        regionKey: string;
        status: string;
        createdAt: string;
    };
    resolvedByUser: {
        id: string;
        name: string | null;
        email: string;
    } | null;
};

export type MatchSlot = {
    id: string;
    matchId: string;
    ticketId: string;
    groupIndex: number;
    teamSnapshot: unknown;
    createdAt: string;
};

export type MatchDisputeDetail = MatchDisputeSummary & {
    match: {
        id: string;
        projectId: string;
        gameModeId: string;
        environment: string;
        regionKey: string;
        status: string;
        ratingMode: string;
        requiredSlots: number;
        groupCount: number;
        createdAt: string;
        updatedAt: string;
        slots: MatchSlot[];
        result: {
            id?: string;
            matchId?: string;
            winnerGroupIndex: number | null;
            endedAt: string;
            createdAt?: string;
        } | null;
        gameMode?: {
            id: string;
            name: string;
            teamCount: number;
            teamSize: number;
        } | null;
    };
};

export type ListDisputesQuery = {
    status?: DisputeStatus | string;
    limit?: number;
    offset?: number;
};

export type ResolveDisputeInput = {
    overrideWinnerGroupIndex?: number | null;
    resolutionNotes: string;
};

export type RejectDisputeInput = {
    resolutionNotes: string;
};

export function listDisputes(projectId: string, query?: ListDisputesQuery) {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status.toUpperCase());
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.offset != null) params.set("offset", String(query.offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<Paginated<MatchDisputeSummary>>(`/projects/${projectId}/disputes${qs}`);
}

export function getDispute(projectId: string, disputeId: string) {
    return apiFetch<MatchDisputeDetail>(`/projects/${projectId}/disputes/${disputeId}`);
}

export function resolveDispute(projectId: string, disputeId: string, input: ResolveDisputeInput) {
    return apiFetch<MatchDisputeDetail>(`/projects/${projectId}/disputes/${disputeId}/resolve`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function rejectDispute(projectId: string, disputeId: string, input: RejectDisputeInput) {
    return apiFetch<MatchDisputeDetail>(`/projects/${projectId}/disputes/${disputeId}/reject`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export type PenaltyReason = "DODGE" | "AFK_TIMEOUT" | "MANUAL_LOCKOUT";

export type PlayerPenaltySummary = {
    id: string;
    projectId: string;
    playerId: string;
    reason: PenaltyReason;
    durationSeconds: number;
    expiresAt: string;
    violationCount: number;
    isActive: boolean;
    revokedAt: string | null;
    revokedByUser: { id: string; name: string | null; email: string } | null;
    revocationNotes: string | null;
    createdAt: string;
};

export type ListPenaltiesQuery = {
    status?: "ACTIVE" | "EXPIRED" | "REVOKED";
    playerId?: string;
    limit?: number;
    offset?: number;
};

export function listPenalties(projectId: string, query?: ListPenaltiesQuery) {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.playerId) params.set("playerId", query.playerId);
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.offset != null) params.set("offset", String(query.offset));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<Paginated<PlayerPenaltySummary>>(`/projects/${projectId}/penalties${qs}`);
}

export function createManualPenalty(
    projectId: string,
    input: { playerId: string; durationSeconds: number; reason?: PenaltyReason; notes?: string },
) {
    return apiFetch<PlayerPenaltySummary>(`/projects/${projectId}/penalties`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function pardonPenalty(projectId: string, penaltyId: string, notes?: string) {
    return apiFetch<PlayerPenaltySummary>(`/projects/${projectId}/penalties/${penaltyId}`, {
        method: "DELETE",
        body: JSON.stringify({ notes }),
    });
}

export function updateProject(
    projectId: string,
    input: {
        name?: string;
        defaultRegion?: string;
        enableDodgePenalty?: boolean;
        penaltyTiers?: number[];
        penaltyDecayHours?: number;
    },
) {
    return apiFetch<ProjectDetail>(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

// Phase 16: Audit Logs & SaaS Billing Types and API Helpers
export type AuditLogItem = {
    id: string;
    organizationId: string;
    projectId: string | null;
    actorUserId: string | null;
    actorIp: string | null;
    actorUserAgent: string | null;
    action: string;
    targetResourceType: string;
    targetResourceId: string;
    metadataBefore: Record<string, unknown> | null;
    metadataAfter: Record<string, unknown> | null;
    description: string | null;
    createdAt: string;
    actorUser?: { id: string; email: string; name: string | null } | null;
    project?: { id: string; name: string; slug: string } | null;
};

export type AuditLogPagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

export type AuditLogResponse = {
    items: AuditLogItem[];
    pagination: AuditLogPagination;
};

export function getProjectAuditLogs(
    projectId: string,
    query?: { page?: number; limit?: number; action?: string; resourceType?: string; actorUserId?: string },
) {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.action) params.set("action", query.action);
    if (query?.resourceType) params.set("resourceType", query.resourceType);
    if (query?.actorUserId) params.set("actorUserId", query.actorUserId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<AuditLogResponse>(`/projects/${projectId}/audit-logs${qs}`);
}

export function getOrganizationAuditLogs(
    organizationId: string,
    query?: { page?: number; limit?: number; action?: string; resourceType?: string; actorUserId?: string },
) {
    const params = new URLSearchParams();
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.action) params.set("action", query.action);
    if (query?.resourceType) params.set("resourceType", query.resourceType);
    if (query?.actorUserId) params.set("actorUserId", query.actorUserId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<AuditLogResponse>(`/organizations/${organizationId}/audit-logs${qs}`);
}

export type SubscriptionPlanTier = "FREE" | "PRO" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" | "UNPAID";

export type OrganizationSubscriptionSummary = {
    planTier: SubscriptionPlanTier;
    limits: {
        maxMonthlyMatches: number;
        maxMonthlyEnqueues: number;
        maxActivePools: number;
        maxWebhooks: number;
        maxMembers: number;
        auditLogRetentionDays: number;
    };
    usage: {
        matchesCreated: number;
        enqueueRequests: number;
        webhookDeliveries: number;
        peakActivePools: number;
    };
    subscription: {
        status: SubscriptionStatus;
        planTier: SubscriptionPlanTier;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
    } | null;
};

export function getOrganizationSubscription(organizationId: string) {
    return apiFetch<OrganizationSubscriptionSummary>(`/organizations/${organizationId}/billing/subscription`);
}

export function createCheckoutSession(
    organizationId: string,
    planTier: SubscriptionPlanTier = "PRO",
    returnUrl?: string,
) {
    return apiFetch<{ url: string }>(`/organizations/${organizationId}/billing/checkout`, {
        method: "POST",
        body: JSON.stringify({ planTier, returnUrl }),
    });
}

export function createBillingPortalSession(organizationId: string, returnUrl?: string) {
    return apiFetch<{ url: string }>(`/organizations/${organizationId}/billing/portal`, {
        method: "POST",
        body: JSON.stringify({ returnUrl }),
    });
}
