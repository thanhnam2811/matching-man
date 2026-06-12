import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { ApiKeysService } from "./api-keys.service";

@UseGuards(DashboardAdminGuard)
@Controller("projects/:projectId/api-keys")
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @Post()
    create(@Param("projectId") projectId: string, @Body() createApiKeyDto: CreateApiKeyDto) {
        return this.apiKeysService.create(projectId, createApiKeyDto);
    }

    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.apiKeysService.findAll(projectId);
    }

    @Post(":apiKeyId/revoke")
    revoke(@Param("projectId") projectId: string, @Param("apiKeyId") apiKeyId: string) {
        return this.apiKeysService.revoke(projectId, apiKeyId);
    }
}