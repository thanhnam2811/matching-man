import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DashboardAuthRequest } from "../../interfaces/dashboard-auth-request";
import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Authorizes access to a `projects/:projectId/...` route. Must run after
 * `DashboardAuthGuard` (which sets `isSuperAdmin` / `authUserId`). Super-admins
 * bypass; otherwise the caller must be a member of the project's organization.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
    constructor(private readonly prismaService: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<DashboardAuthRequest>();

        if (request.isSuperAdmin) {
            return true;
        }

        const userId = request.authUserId;
        const projectId = request.params?.projectId;

        if (!userId || typeof projectId !== "string") {
            throw new ForbiddenException("You do not have access to this project");
        }

        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        const membership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { id: true },
        });

        if (!membership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        return true;
    }
}