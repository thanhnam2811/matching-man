import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateWebhookDto } from "./dto/create-webhook.dto";
import { UpdateWebhookDto } from "./dto/update-webhook.dto";
import { WebhooksService } from "./webhooks.service";

@ApiTags("Webhooks")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/webhooks")
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) {}

    @ApiOperation({ summary: "Register a webhook endpoint for a project." })
    @Post()
    create(@Param("projectId") projectId: string, @Body() createWebhookDto: CreateWebhookDto) {
        return this.webhooksService.create(projectId, createWebhookDto);
    }

    @ApiOperation({ summary: "List webhook endpoints. Signing secrets are not exposed after creation." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.webhooksService.findAll(projectId);
    }

    @ApiOperation({ summary: "Update a webhook endpoint." })
    @Patch(":webhookId")
    update(
        @Param("projectId") projectId: string,
        @Param("webhookId") webhookId: string,
        @Body() updateWebhookDto: UpdateWebhookDto,
    ) {
        return this.webhooksService.update(projectId, webhookId, updateWebhookDto);
    }

    @ApiOperation({ summary: "Delete a webhook endpoint." })
    @Delete(":webhookId")
    remove(@Param("projectId") projectId: string, @Param("webhookId") webhookId: string) {
        return this.webhooksService.remove(projectId, webhookId);
    }
}
