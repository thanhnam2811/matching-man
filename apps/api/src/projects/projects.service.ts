import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import { CreateProjectDto } from "./dto/create-project.dto";

@Injectable()
export class ProjectsService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(createProjectDto: CreateProjectDto) {
        const projectSlug = normalizeSlug(createProjectDto.slug);
        const organizationSlug = normalizeSlug(createProjectDto.organization.slug);
        const environmentNames = Array.from(
            new Set(
                (createProjectDto.environments?.length
                    ? createProjectDto.environments
                    : ["development", "production"]
                ).map((environment) => environment.trim().toLowerCase()),
            ),
        );

        try {
            const created = await this.prismaService.client.$transaction(async (tx) => {
                const owner = await tx.user.upsert({
                    where: {
                        email: createProjectDto.owner.email.toLowerCase(),
                    },
                    update: {
                        name: createProjectDto.owner.name ?? undefined,
                    },
                    create: {
                        email: createProjectDto.owner.email.toLowerCase(),
                        name: createProjectDto.owner.name,
                    },
                });

                const organization = await tx.organization.create({
                    data: {
                        name: createProjectDto.organization.name,
                        slug: organizationSlug,
                        createdById: owner.id,
                    },
                });

                const project = await tx.project.create({
                    data: {
                        name: createProjectDto.name,
                        slug: projectSlug,
                        defaultRegion: createProjectDto.defaultRegion,
                        organizationId: organization.id,
                        environments: {
                            create: environmentNames.map((name, index) => ({
                                name,
                                isDefault: index === 0,
                            })),
                        },
                        members: {
                            create: {
                                userId: owner.id,
                                role: ProjectMemberRole.OWNER,
                            },
                        },
                    },
                    include: {
                        organization: true,
                        environments: true,
                        members: {
                            include: {
                                user: true,
                            },
                        },
                    },
                });

                return project;
            });

            return {
                id: created.id,
                name: created.name,
                slug: created.slug,
                defaultRegion: created.defaultRegion,
                createdAt: created.createdAt,
                organization: {
                    id: created.organization.id,
                    name: created.organization.name,
                    slug: created.organization.slug,
                },
                owner: created.members[0]
                    ? {
                          id: created.members[0].user.id,
                          email: created.members[0].user.email,
                          name: created.members[0].user.name,
                          role: created.members[0].role,
                      }
                    : null,
                environments: created.environments.map((environment) => ({
                    id: environment.id,
                    name: environment.name,
                    isDefault: environment.isDefault,
                })),
            };
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === "P2002") {
                    throw new ConflictException("Project or organization slug already exists");
                }
            }

            throw error;
        }
    }

    findAll() {
        return this.prismaService.client.project.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                environments: {
                    orderBy: {
                        name: "asc",
                    },
                },
            },
        });
    }

    async findOne(projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: {
                id: projectId,
            },
            include: {
                organization: true,
                environments: {
                    orderBy: {
                        name: "asc",
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                    },
                },
                webhookEndpoints: true,
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        return project;
    }
}