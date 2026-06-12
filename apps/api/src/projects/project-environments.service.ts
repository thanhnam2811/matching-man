import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const normalizeProjectEnvironmentName = (environment: string) => environment.trim().toLowerCase();

@Injectable()
export class ProjectEnvironmentsService {
    constructor(private readonly prismaService: PrismaService) {}

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
}