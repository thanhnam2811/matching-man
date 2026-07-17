import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { OrganizationsService } from "../organizations/organizations.service";
import { CreateProjectDto } from "./dto/create-project.dto";

@Injectable()
export class ProjectsService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly organizationsService: OrganizationsService,
    ) {}

    async create(context: DashboardAuthContext, createProjectDto: CreateProjectDto) {
        await this.organizationsService.assertAccess(context, createProjectDto.organizationId);

        const projectSlug = normalizeSlug(createProjectDto.slug);
        const environmentNames = Array.from(
            new Set(
                (createProjectDto.environments?.length
                    ? createProjectDto.environments
                    : ["development", "production"]
                ).map((environment) => environment.trim().toLowerCase()),
            ),
        );

        try {
            const created = await this.prismaService.client.project.create({
                data: {
                    name: createProjectDto.name,
                    slug: projectSlug,
                    defaultRegion: createProjectDto.defaultRegion,
                    organizationId: createProjectDto.organizationId,
                    environments: {
                        create: environmentNames.map((name, index) => ({ name, isDefault: index === 0 })),
                    },
                    ...(context.authUserId
                        ? { members: { create: { userId: context.authUserId, role: ProjectMemberRole.OWNER } } }
                        : {}),
                },
                include: {
                    organization: { select: { id: true, name: true, slug: true } },
                    environments: true,
                },
            });

            return {
                id: created.id,
                name: created.name,
                slug: created.slug,
                defaultRegion: created.defaultRegion,
                createdAt: created.createdAt,
                organization: created.organization,
                environments: created.environments.map((environment) => ({
                    id: environment.id,
                    name: environment.name,
                    isDefault: environment.isDefault,
                })),
            };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException("Project slug already exists");
            }
            throw error;
        }
    }

    findAll(context: DashboardAuthContext) {
        return this.prismaService.client.project.findMany({
            where: context.isSuperAdmin
                ? {}
                : {
                      OR: [
                          {
                              organization: {
                                  members: {
                                      some: {
                                          userId: context.authUserId,
                                          role: { in: [ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN] },
                                      },
                                  },
                              },
                          },
                          { members: { some: { userId: context.authUserId } } },
                      ],
                  },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                slug: true,
                defaultRegion: true,
                createdAt: true,
                organization: { select: { id: true, name: true, slug: true } },
            },
        });
    }

    async findOne(context: DashboardAuthContext, projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            include: {
                organization: true,
                environments: { orderBy: { name: "asc" } },
                members: {
                    include: { user: { select: { id: true, email: true, name: true } } },
                },
                webhookEndpoints: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        await this.organizationsService.assertAccess(context, project.organizationId);

        return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            defaultRegion: project.defaultRegion,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            organization: project.organization,
            environments: project.environments,
            members: project.members.map((member) => ({
                id: member.id,
                role: member.role,
                createdAt: member.createdAt,
                user: member.user,
            })),
            webhookEndpoints: project.webhookEndpoints.map((webhook) => ({
                id: webhook.id,
                url: webhook.url,
                events: webhook.events,
                isActive: webhook.isActive,
                createdAt: webhook.createdAt,
                updatedAt: webhook.updatedAt,
                hasSecret: true,
            })),
        };
    }
}
