import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DashboardAuthRequest } from "../../interfaces/dashboard-auth-request";
import { PrismaService } from "../../../prisma/prisma.service";
import { ProjectMemberRole } from "../../../generated/prisma/client";
import { ROLE_RANK } from "../../../organizations/organizations.service";

/**
 * Authorizes access to a `projects/:projectId/...` route. Must run after
 * `DashboardAuthGuard` (which sets `isSuperAdmin` / `authUserId`). Super-admins
 * bypass. Org OWNER/ADMIN have access to every project in their org. Org MEMBER
 * needs an explicit `ProjectMember` row for this specific project.
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

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { role: true },
        });

        if (!orgMembership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        if (ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return true;
        }

        const projectMembership = await this.prismaService.client.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId } },
            select: { id: true },
        });

        if (!projectMembership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        return true;
    }
}
