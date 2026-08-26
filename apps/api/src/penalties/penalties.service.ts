import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PenaltyReason, Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { ROLE_RANK } from "../organizations/organizations.service";

export interface RecordPenaltyParams {
    projectId: string;
    playerId: string;
    reason: PenaltyReason;
    durationSeconds?: number;
    notes?: string;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class PenaltiesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
    ) {}

    async recordPenalty(params: RecordPenaltyParams) {
        const project = await this.prismaService.client.project.findUnique({
            where: { id: params.projectId },
            select: {
                enableDodgePenalty: true,
                penaltyTiers: true,
                penaltyDecayHours: true,
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        // If automatic dodge penalty is disabled and this is a dodge/AFK reason, skip
        if (!project.enableDodgePenalty && params.reason !== PenaltyReason.MANUAL_LOCKOUT) {
            return null;
        }

        const decayHours = project.penaltyDecayHours ?? 24;
        const decayThreshold = new Date(Date.now() - decayHours * 60 * 60 * 1000);

        const recentPenalties = await this.prismaService.client.playerPenalty.findMany({
            where: {
                projectId: params.projectId,
                playerId: params.playerId,
                createdAt: { gte: decayThreshold },
                revokedAt: null,
            },
            orderBy: { createdAt: "desc" },
        });

        const violationCount = recentPenalties.length + 1;
        let durationSeconds = params.durationSeconds;

        if (!durationSeconds) {
            const tiers: number[] = Array.isArray(project.penaltyTiers)
                ? (project.penaltyTiers as number[])
                : [180, 900, 3600, 86400];
            const tierIndex = Math.min(recentPenalties.length, tiers.length - 1);
            durationSeconds = tiers[tierIndex] ?? 180;
        }

        const expiresAt = new Date(Date.now() + durationSeconds * 1000);

        const penalty = await this.prismaService.client.playerPenalty.create({
            data: {
                projectId: params.projectId,
                playerId: params.playerId,
                reason: params.reason,
                durationSeconds,
                expiresAt,
                violationCount,
                revocationNotes: params.notes,
                metadata: params.metadata as Prisma.InputJsonValue | undefined,
            },
        });

        await this.webhookDeliveryService.scheduleDelivery(params.projectId, "player.penalized", {
            event: "player.penalized",
            penaltyId: penalty.id,
            playerId: penalty.playerId,
            reason: penalty.reason,
            durationSeconds: penalty.durationSeconds,
            expiresAt: penalty.expiresAt.toISOString(),
            violationCount: penalty.violationCount,
        });

        return penalty;
    }

    async checkActivePenalties(projectId: string, playerIds: string[]) {
        if (!playerIds.length) {
            return null;
        }

        const now = new Date();
        return this.prismaService.client.playerPenalty.findFirst({
            where: {
                projectId,
                playerId: { in: playerIds },
                expiresAt: { gt: now },
                revokedAt: null,
            },
            orderBy: { expiresAt: "desc" },
        });
    }

    async getActivePenalty(projectId: string, playerId: string) {
        const now = new Date();
        return this.prismaService.client.playerPenalty.findFirst({
            where: {
                projectId,
                playerId,
                expiresAt: { gt: now },
                revokedAt: null,
            },
            orderBy: { expiresAt: "desc" },
        });
    }

    async listPenalties(
        context: DashboardAuthContext,
        projectId: string,
        query: { status?: string; playerId?: string; limit?: number; offset?: number },
    ) {
        await this.assertProjectAccess(context, projectId);

        const limit = Math.min(query.limit ?? 50, 100);
        const offset = query.offset ?? 0;
        const now = new Date();

        const where: Prisma.PlayerPenaltyWhereInput = {
            projectId,
            ...(query.playerId ? { playerId: { contains: query.playerId } } : {}),
            ...(query.status === "ACTIVE"
                ? { expiresAt: { gt: now }, revokedAt: null }
                : query.status === "EXPIRED"
                  ? { expiresAt: { lte: now }, revokedAt: null }
                  : query.status === "REVOKED"
                    ? { revokedAt: { not: null } }
                    : {}),
        };

        const [penalties, total] = await Promise.all([
            this.prismaService.client.playerPenalty.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    revokedByUser: { select: { id: true, email: true, name: true } },
                },
            }),
            this.prismaService.client.playerPenalty.count({ where }),
        ]);

        return {
            data: penalties.map((p) => ({
                id: p.id,
                projectId: p.projectId,
                playerId: p.playerId,
                reason: p.reason,
                durationSeconds: p.durationSeconds,
                expiresAt: p.expiresAt,
                violationCount: p.violationCount,
                isActive: p.expiresAt > now && p.revokedAt === null,
                revokedAt: p.revokedAt,
                revokedByUser: p.revokedByUser,
                revocationNotes: p.revocationNotes,
                createdAt: p.createdAt,
            })),
            total,
            limit,
            offset,
        };
    }

    async createManualPenalty(
        context: DashboardAuthContext,
        projectId: string,
        dto: { playerId: string; durationSeconds: number; reason?: PenaltyReason; notes?: string },
    ) {
        await this.assertProjectAdminAccess(context, projectId);

        return this.recordPenalty({
            projectId,
            playerId: dto.playerId,
            reason: dto.reason ?? PenaltyReason.MANUAL_LOCKOUT,
            durationSeconds: dto.durationSeconds,
            notes: dto.notes,
            metadata: { createdByUserId: context.authUserId },
        });
    }

    async pardonPenalty(context: DashboardAuthContext, projectId: string, penaltyId: string, revocationNotes?: string) {
        await this.assertProjectAdminAccess(context, projectId);

        const penalty = await this.prismaService.client.playerPenalty.findFirst({
            where: { id: penaltyId, projectId },
        });

        if (!penalty) {
            throw new NotFoundException("Penalty record not found");
        }

        return this.prismaService.client.playerPenalty.update({
            where: { id: penaltyId },
            data: {
                revokedAt: new Date(),
                revokedByUserId: context.authUserId,
                revocationNotes: revocationNotes ?? "Pardoned by project administrator",
            },
            include: {
                revokedByUser: { select: { id: true, email: true, name: true } },
            },
        });
    }

    private async assertProjectAccess(context: DashboardAuthContext, projectId: string) {
        if (context.isSuperAdmin) {
            return;
        }

        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            include: { members: { select: { userId: true } } },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        const userId = context.authUserId;
        if (!userId) {
            throw new ForbiddenException("You do not have access to this project");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { role: true },
        });

        if (orgMembership && ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return;
        }

        if (!project.members.some((m) => m.userId === userId)) {
            throw new ForbiddenException("You do not have access to this project");
        }
    }

    private async assertProjectAdminAccess(context: DashboardAuthContext, projectId: string) {
        if (context.isSuperAdmin) {
            return;
        }

        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            include: { members: { select: { userId: true, role: true } } },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        const userId = context.authUserId;
        if (!userId) {
            throw new ForbiddenException("You do not have administrative access to this project");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { role: true },
        });

        if (orgMembership && ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return;
        }

        const member = project.members.find((m) => m.userId === userId);
        if (!member || ROLE_RANK[member.role] < ROLE_RANK[ProjectMemberRole.ADMIN]) {
            throw new ForbiddenException("You do not have administrative access to this project");
        }
    }
}
