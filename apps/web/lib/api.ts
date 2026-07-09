import { cookies } from "next/headers";
import { ApiError, NetworkError, TimeoutError } from "./api-errors";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/v1";
export const TOKEN_COOKIE = "dashboard_token";

export { ApiError, NetworkError, TimeoutError } from "./api-errors";

/**
 * Server-side fetch against the NestJS API. Reads the dashboard admin token
 * from the httpOnly cookie so it never reaches the browser.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = (await cookies()).get(TOKEN_COOKIE)?.value;

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        const body = await response.text().catch(() => "");
        throw new ApiError(response.status, body || response.statusText);
    }

    return response.json() as Promise<T>;
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

export type CurrentUser = {
    id: string;
    email: string;
    name: string | null;
    organizations: OrganizationMembership[];
};

export function getCurrentUser() {
    return apiFetch<CurrentUser>("/auth/me");
}

export type Project = {
    id: string;
    name: string;
    slug: string;
    defaultRegion: string | null;
    createdAt: string;
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
