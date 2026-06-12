import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { UpdateWebhookDto } from "./dto/update-webhook.dto";
import { WebhooksService } from "./webhooks.service";

@UseGuards(DashboardAdminGuard)
@Controller("projects/:projectId/webhooks")
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) {}

    @Post()
    create(@Param("projectId") projectId: string, @Body() createWebhookDto: CreateWebhookDto) {
        return this.webhooksService.create(projectId, createWebhookDto);
    }

    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.webhooksService.findAll(projectId);
    }

    @Patch(":webhookId")
    update(
        @Param("projectId") projectId: string,
        @Param("webhookId") webhookId: string,
        @Body() updateWebhookDto: UpdateWebhookDto,
    ) {
        return this.webhooksService.update(projectId, webhookId, updateWebhookDto);
    }

    @Delete(":webhookId")
    remove(@Param("projectId") projectId: string, @Param("webhookId") webhookId: string) {
        return this.webhooksService.remove(projectId, webhookId);
    }
}