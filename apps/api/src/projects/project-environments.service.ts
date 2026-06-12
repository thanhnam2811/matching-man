import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectEnvironmentDto } from "./dto/create-project-environment.dto";
import { UpdateProjectEnvironmentDto } from "./dto/update-project-environment.dto";

export const normalizeProjectEnvironmentName = (environment: string) => environment.trim().toLowerCase();

@Injectable()
export class ProjectEnvironmentsService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAll(projectId: string) {
        await this.ensureProjectExists(projectId);

        return this.prismaService.client.projectEnvironment.findMany({
            where: {
                projectId,
            },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        });
    }

    async create(projectId: string, createProjectEnvironmentDto: CreateProjectEnvironmentDto) {
        await this.ensureProjectExists(projectId);
        const normalizedName = normalizeProjectEnvironmentName(createProjectEnvironmentDto.name);

        const existing = await this.prismaService.client.projectEnvironment.findUnique({
            where: {
                projectId_name: {
                    projectId,
                    name: normalizedName,
                },
            },
            select: {
                id: true,
            },
        });

        if (existing) {
            throw new ConflictException("Environment already exists for this project");
        }

        return this.prismaService.client.$transaction(async (tx) => {
            if (createProjectEnvironmentDto.isDefault) {
                await tx.projectEnvironment.updateMany({
                    where: {
                        projectId,
                    },
                    data: {
                        isDefault: false,
                    },
                });
            }

            return tx.projectEnvironment.create({
                data: {
                    projectId,
                    name: normalizedName,
                    isDefault: createProjectEnvironmentDto.isDefault ?? false,
                },
            });
        });
    }

    async update(projectId: string, environmentId: string, updateProjectEnvironmentDto: UpdateProjectEnvironmentDto) {
        const environment = await this.getEnvironment(projectId, environmentId);
        const nextName = updateProjectEnvironmentDto.name
            ? normalizeProjectEnvironmentName(updateProjectEnvironmentDto.name)
            : environment.name;

        if (nextName !== environment.name) {
            const duplicate = await this.prismaService.client.projectEnvironment.findUnique({
                where: {
                    projectId_name: {
                        projectId,
                        name: nextName,
                    },
                },
                select: {
                    id: true,
                },
            });

            if (duplicate && duplicate.id !== environment.id) {
                throw new ConflictException("Environment already exists for this project");
            }
        }

        return this.prismaService.client.$transaction(async (tx) => {
            if (updateProjectEnvironmentDto.isDefault) {
                await tx.projectEnvironment.updateMany({
                    where: {
                        projectId,
                    },
                    data: {
                        isDefault: false,
                    },
                });
            }

            if (environment.isDefault && updateProjectEnvironmentDto.isDefault === false) {
                throw new ConflictException("Project must keep a default environment");
            }

            return tx.projectEnvironment.update({
                where: {
                    id: environment.id,
                },
                data: {
                    name: nextName,
                    isDefault: updateProjectEnvironmentDto.isDefault,
                },
            });
        });
    }

    async remove(projectId: string, environmentId: string) {
        const environment = await this.getEnvironment(projectId, environmentId);

        if (environment.isDefault) {
            const environmentCount = await this.prismaService.client.projectEnvironment.count({
                where: {
                    projectId,
                },
            });

            if (environmentCount > 1) {
                throw new ConflictException("Move the default designation before deleting this environment");
            }

            throw new ConflictException("Project must keep at least one environment");
        }

        await this.prismaService.client.projectEnvironment.delete({
            where: {
                id: environment.id,
            },
        });

        return {
            id: environment.id,
            deleted: true,
        };
    }

    async assertExists(projectId: string, environment: string) {
        const normalizedEnvironment = normalizeProjectEnvironmentName(environment);
        const projectEnvironment = await this.prismaService.client.projectEnvironment.findUnique({
            where: {
                projectId_name: {
                    projectId,
                    name: normalizedEnvironment,
                },
            },
            select: {
                name: true,
            },
        });

        if (!projectEnvironment) {
            throw new BadRequestException("Environment is not configured for this project");
        }

        return normalizedEnvironment;
    }

    async isConfigured(projectId: string, environment: string) {
        const normalizedEnvironment = normalizeProjectEnvironmentName(environment);
        const projectEnvironment = await this.prismaService.client.projectEnvironment.findUnique({
            where: {
                projectId_name: {
                    projectId,
                    name: normalizedEnvironment,
                },
            },
            select: {
                id: true,
            },
        });

        return Boolean(projectEnvironment);
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

    private async getEnvironment(projectId: string, environmentId: string) {
        const environment = await this.prismaService.client.projectEnvironment.findFirst({
            where: {
                id: environmentId,
                projectId,
            },
        });

        if (!environment) {
            throw new NotFoundException("Project environment not found");
        }

        return environment;
    }
}