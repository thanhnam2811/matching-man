import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_RANK } from "../organizations/organizations.service";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { CreateProjectMemberDto } from "./dto/create-project-member.dto";
import { UpdateProjectMemberDto } from "./dto/update-project-member.dto";

@Injectable()
export class ProjectMembersService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAll(projectId: string) {
        await this.ensureProjectExists(projectId);

        const members = await this.prismaService.client.projectMember.findMany({
            where: {
                projectId,
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return members.map((member) => ({
            id: member.id,
            role: member.role,
            createdAt: member.createdAt,
            user: member.user,
        }));
    }

    async create(context: DashboardAuthContext, projectId: string, createProjectMemberDto: CreateProjectMemberDto) {
        await this.assertManageAccess(context, projectId);

        const user = await this.prismaService.client.user.findUnique({
            where: { email: createProjectMemberDto.email.toLowerCase() },
            select: { id: true, email: true, name: true },
        });

        if (!user) {
            throw new NotFoundException("No registered user with that email; ask them to sign up first");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findFirst({
            where: {
                userId: user.id,
                organization: { projects: { some: { id: projectId } } },
            },
            select: { id: true },
        });

        if (!orgMembership) {
            throw new ForbiddenException(
                "User is not a member of this project's organization; add them to the organization first",
            );
        }

        const existing = await this.prismaService.client.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id,
                },
            },
        });

        if (existing) {
            throw new ConflictException("Project member already exists");
        }

        const member = await this.prismaService.client.projectMember.create({
            data: {
                projectId,
                userId: user.id,
                role: createProjectMemberDto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return {
            id: member.id,
            role: member.role,
            createdAt: member.createdAt,
            user: member.user,
        };
    }

    async update(
        context: DashboardAuthContext,
        projectId: string,
        memberId: string,
        updateProjectMemberDto: UpdateProjectMemberDto,
    ) {
        await this.assertManageAccess(context, projectId);

        const member = await this.getMember(projectId, memberId);

        if (member.role === ProjectMemberRole.OWNER && updateProjectMemberDto.role !== ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(projectId, member.id);
        }

        const updated = await this.prismaService.client.projectMember.update({
            where: {
                id: member.id,
            },
            data: {
                role: updateProjectMemberDto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return {
            id: updated.id,
            role: updated.role,
            createdAt: updated.createdAt,
            user: updated.user,
        };
    }

    async remove(context: DashboardAuthContext, projectId: string, memberId: string) {
        await this.assertManageAccess(context, projectId);

        const member = await this.getMember(projectId, memberId);

        if (member.role === ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(projectId, member.id);
        }

        await this.prismaService.client.projectMember.delete({
            where: {
                id: member.id,
            },
        });

        return {
            id: member.id,
            deleted: true,
        };
    }

    /**
     * Requires org role >= ADMIN OR project role >= ADMIN. Super-admins bypass.
     */
    private async assertManageAccess(context: DashboardAuthContext, projectId: string) {
        if (context.isSuperAdmin) {
            return;
        }

        const userId = context.authUserId;
        if (!userId) {
            throw new ForbiddenException("You do not have permission to manage this project's members");
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

        if (orgMembership && ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return;
        }

        const projectMembership = await this.prismaService.client.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId } },
            select: { role: true },
        });

        if (!projectMembership || ROLE_RANK[projectMembership.role] < ROLE_RANK[ProjectMemberRole.ADMIN]) {
            throw new ForbiddenException("You do not have permission to manage this project's members");
        }
    }

    private async ensureProjectExists(projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: {
                id: projectId,
            },
            select: {
                id: true,
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }
    }

    private async getMember(projectId: string, memberId: string) {
        const member = await this.prismaService.client.projectMember.findFirst({
            where: {
                id: memberId,
                projectId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!member) {
            throw new NotFoundException("Project member not found");
        }

        return member;
    }

    private async assertNotLastOwner(projectId: string, memberId: string) {
        const ownerCount = await this.prismaService.client.projectMember.count({
            where: {
                projectId,
                role: ProjectMemberRole.OWNER,
            },
        });

        if (ownerCount <= 1) {
            throw new ConflictException("Project must keep at least one owner");
        }

        const currentOwner = await this.prismaService.client.projectMember.findFirst({
            where: {
                id: memberId,
                projectId,
                role: ProjectMemberRole.OWNER,
            },
            select: {
                id: true,
            },
        });

        if (!currentOwner) {
            throw new NotFoundException("Project member not found");
        }
    }
}
