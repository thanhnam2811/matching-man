import type { Request } from "express";

export interface AuthenticatedProjectRequest extends Request {
    authProjectId: string;
    authApiKeyId: string;
}