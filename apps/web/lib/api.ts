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
