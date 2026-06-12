import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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

    async create(projectId: string, createProjectMemberDto: CreateProjectMemberDto) {
        await this.ensureProjectExists(projectId);

        const user = await this.prismaService.client.user.upsert({
            where: {
                email: createProjectMemberDto.email.toLowerCase(),
            },
            update: {
                name: createProjectMemberDto.name ?? undefined,
            },
            create: {
                email: createProjectMemberDto.email.toLowerCase(),
                name: createProjectMemberDto.name,
            },
        });

        const existing = await this.prismaService.client.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id,
                },
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

    async update(projectId: string, memberId: string, updateProjectMemberDto: UpdateProjectMemberDto) {
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

    async remove(projectId: string, memberId: string) {
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