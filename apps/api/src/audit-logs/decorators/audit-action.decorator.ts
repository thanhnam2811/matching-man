import { SetMetadata } from "@nestjs/common";
import { AuditAction, AuditResourceType } from "../../generated/prisma/client";

export const AUDIT_ACTION_METADATA_KEY = "AUDIT_ACTION_METADATA_KEY";

export interface AuditActionOptions {
    action: AuditAction;
    resourceType: AuditResourceType;
    description?: string;
}

export const TrackAudit = (options: AuditActionOptions) => SetMetadata(AUDIT_ACTION_METADATA_KEY, options);
