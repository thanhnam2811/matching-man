import type { Request } from "express";

export type DashboardAuthContext = {
    authUserId?: string;
    isSuperAdmin: boolean;
};

export interface DashboardAuthRequest extends Request {
    authUserId?: string;
    isSuperAdmin: boolean;
}

export function toDashboardContext(request: DashboardAuthRequest): DashboardAuthContext {
    return { authUserId: request.authUserId, isSuperAdmin: request.isSuperAdmin };
}
