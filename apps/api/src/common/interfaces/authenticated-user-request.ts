import type { Request } from "express";

export interface AuthenticatedUserRequest extends Request {
    authUserId: string;
}
