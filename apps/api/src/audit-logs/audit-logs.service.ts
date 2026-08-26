import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditResourceType } from "../generated/prisma/client";
import { redactSensitiveData } from "./utils/audit-redactor.util";
import type { AuditLogQueryDto } from "./dto/audit-log-query.dto";

export interface CreateAuditLogParams {
    organizationId: string;
    projectId?: string | null;
    actorUserId?: string | null;
    actorIp?: string | null;
    actorUserAgent?: string | null;
    action: AuditAction;
    targetResourceType: AuditResourceType;
    targetResourceId: string;
    metadataBefore?: any;
    metadataAfter?: any;
    description?: string | null;
}

@Injectable()
export class AuditLogService {
    private readonly logger = new Logger(AuditLogService.name);

    constructor(private readonly prismaService: PrismaService) {}

    async recordLog(params: CreateAuditLogParams): Promise<void> {
        try {
            let organizationId = params.organizationId;

            if ((!organizationId || organizationId === "org_default") && params.projectId) {
                const project = await this.prismaService.client.project.findUnique({
                    where: { id: params.projectId },
                    select: { organizationId: true },
                });
                if (project?.organizationId) {
                    organizationId = project.organizationId;
                }
            }

            if (!organizationId || organizationId === "org_default") {
                this.logger.warn(`Skipping audit log [${params.action}] because organizationId could not be resolved`);
                return;
            }

            const sanitizedBefore =
                params.metadataBefore !== undefined ? redactSensitiveData(params.metadataBefore) : null;
            const sanitizedAfter =
                params.metadataAfter !== undefined ? redactSensitiveData(params.metadataAfter) : null;

            await this.prismaService.client.auditLog.create({
                data: {
                    organizationId,
                    projectId: params.projectId ?? null,
                    actorUserId: params.actorUserId ?? null,
                    actorIp: params.actorIp ?? null,
                    actorUserAgent: params.actorUserAgent ?? null,
                    action: params.action,
                    targetResourceType: params.targetResourceType,
                    targetResourceId: params.targetResourceId,
                    metadataBefore: sanitizedBefore as any,
                    metadataAfter: sanitizedAfter as any,
                    description: params.description ?? null,
                },
            });
        } catch (err: any) {
            // Audit logging must be non-blocking & never crash the main operation
            this.logger.error(`Failed to record audit log [${params.action}]: ${err.message}`, err.stack);
        }
    }

    async findProjectLogs(projectId: string, query: AuditLogQueryDto) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 50));
        const skip = (page - 1) * limit;

        const where = {
            projectId,
            ...(query.action ? { action: query.action } : {}),
            ...(query.resourceType ? { targetResourceType: query.resourceType } : {}),
            ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        };

        const [items, total] = await Promise.all([
            this.prismaService.client.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    actorUser: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                },
            }),
            this.prismaService.client.auditLog.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findOrganizationLogs(organizationId: string, query: AuditLogQueryDto) {
        const page = Math.max(1, query.page || 1);
        const limit = Math.min(100, Math.max(1, query.limit || 50));
        const skip = (page - 1) * limit;

        const where = {
            organizationId,
            ...(query.action ? { action: query.action } : {}),
            ...(query.resourceType ? { targetResourceType: query.resourceType } : {}),
            ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        };

        const [items, total] = await Promise.all([
            this.prismaService.client.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    actorUser: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                        },
                    },
                    project: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            }),
            this.prismaService.client.auditLog.count({ where }),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
