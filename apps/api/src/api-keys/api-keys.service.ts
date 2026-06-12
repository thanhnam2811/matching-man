import { Injectable, NotFoundException } from "@nestjs/common";
import { generateApiKey } from "../common/utils/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";

@Injectable()
export class ApiKeysService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(projectId: string, createApiKeyDto: CreateApiKeyDto) {
        await this.ensureProjectExists(projectId);

        const generated = generateApiKey();
        const apiKey = await this.prismaService.client.apiKey.create({
            data: {
                projectId,
                name: createApiKeyDto.name ?? "default",
                keyPrefix: generated.prefix,
                lastFour: generated.lastFour,
                hashedKey: generated.hashed,
            },
        });

        return {
            id: apiKey.id,
            name: apiKey.name,
            projectId: apiKey.projectId,
            keyPrefix: apiKey.keyPrefix,
            lastFour: apiKey.lastFour,
            key: generated.raw,
            createdAt: apiKey.createdAt,
        };
    }

    async findAll(projectId: string) {
        await this.ensureProjectExists(projectId);

        return this.prismaService.client.apiKey.findMany({
            where: {
                projectId,
            },
            orderBy: {
                createdAt: "desc",
            },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                lastFour: true,
                isRevoked: true,
                revokedAt: true,
                createdAt: true,
            },
        });
    }

    async revoke(projectId: string, apiKeyId: string) {
        const apiKey = await this.prismaService.client.apiKey.findFirst({
            where: {
                id: apiKeyId,
                projectId,
            },
            select: {
                id: true,
                isRevoked: true,
            },
        });

        if (!apiKey) {
            throw new NotFoundException("API key not found");
        }

        if (apiKey.isRevoked) {
            return {
                id: apiKey.id,
                revoked: true,
            };
        }

        await this.prismaService.client.apiKey.update({
            where: {
                id: apiKeyId,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        });

        return {
            id: apiKey.id,
            revoked: true,
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
}