import { Injectable, NotFoundException } from "@nestjs/common";
import { generateSigningSecret } from "../common/utils/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { UpdateWebhookDto } from "./dto/update-webhook.dto";

@Injectable()
export class WebhooksService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(projectId: string, createWebhookDto: CreateWebhookDto) {
        await this.ensureProjectExists(projectId);

        return this.prismaService.client.webhookEndpoint.create({
            data: {
                projectId,
                url: createWebhookDto.url,
                events: createWebhookDto.events,
                secret: createWebhookDto.secret ?? generateSigningSecret(),
            },
        });
    }

    async findAll(projectId: string) {
        await this.ensureProjectExists(projectId);

        const webhooks = await this.prismaService.client.webhookEndpoint.findMany({
            where: {
                projectId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return webhooks.map((webhook) => ({
            id: webhook.id,
            projectId: webhook.projectId,
            url: webhook.url,
            events: webhook.events,
            isActive: webhook.isActive,
            createdAt: webhook.createdAt,
            updatedAt: webhook.updatedAt,
            hasSecret: true,
        }));
    }

    async update(projectId: string, webhookId: string, updateWebhookDto: UpdateWebhookDto) {
        await this.ensureWebhookExists(projectId, webhookId);

        return this.prismaService.client.webhookEndpoint.update({
            where: {
                id: webhookId,
            },
            data: {
                url: updateWebhookDto.url,
                events: updateWebhookDto.events,
                secret: updateWebhookDto.secret,
                isActive: updateWebhookDto.isActive,
            },
        });
    }

    async remove(projectId: string, webhookId: string) {
        await this.ensureWebhookExists(projectId, webhookId);

        await this.prismaService.client.webhookEndpoint.delete({
            where: {
                id: webhookId,
            },
        });

        return {
            id: webhookId,
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

    private async ensureWebhookExists(projectId: string, webhookId: string) {
        const webhook = await this.prismaService.client.webhookEndpoint.findFirst({
            where: {
                id: webhookId,
                projectId,
            },
            select: {
                id: true,
            },
        });

        if (!webhook) {
            throw new NotFoundException("Webhook endpoint not found");
        }
    }
}