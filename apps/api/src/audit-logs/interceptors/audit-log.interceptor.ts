import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AUDIT_ACTION_METADATA_KEY, AuditActionOptions } from "../decorators/audit-action.decorator";
import { AuditLogService } from "../audit-logs.service";

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly auditLogService: AuditLogService,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const auditOptions = this.reflector.getAllAndOverride<AuditActionOptions | undefined>(
            AUDIT_ACTION_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!auditOptions) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const actorUserId = request.authUserId ?? null;
        const rawIp =
            (request.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
            request.ip ||
            request.connection?.remoteAddress ||
            null;
        const actorIp = rawIp ? rawIp.replace(/^::ffff:/, "") : null;
        const actorUserAgent =
            (request.headers?.["x-forwarded-user-agent"] as string) || request.headers?.["user-agent"] || null;
        const bodyBefore = request.body ? { ...request.body } : null;

        return next.handle().pipe(
            tap((responseData) => {
                // Determine resource ID and context asynchronously
                const projectId = request.params?.projectId || request.params?.id || responseData?.projectId || null;
                const organizationId =
                    request.organizationId ||
                    request.params?.orgId ||
                    request.params?.organizationId ||
                    responseData?.organizationId ||
                    null;
                const targetResourceId =
                    responseData?.id ||
                    request.params?.id ||
                    request.params?.penaltyId ||
                    request.params?.memberId ||
                    "unknown";

                // If organizationId is missing but projectId is known, auditLogService can resolve or save directly
                this.auditLogService
                    .recordLog({
                        organizationId: organizationId || responseData?.project?.organizationId || "org_default",
                        projectId,
                        actorUserId,
                        actorIp,
                        actorUserAgent,
                        action: auditOptions.action,
                        targetResourceType: auditOptions.resourceType,
                        targetResourceId: String(targetResourceId),
                        metadataBefore: bodyBefore,
                        metadataAfter: responseData,
                        description: auditOptions.description,
                    })
                    .catch(() => {});
            }),
        );
    }
}
