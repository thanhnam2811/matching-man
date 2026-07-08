import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { ApiKeysService } from "./api-keys.service";

@ApiTags("API Keys")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/api-keys")
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @ApiOperation({ summary: "Create a project API key. The raw key is only returned once, at creation." })
    @Post()
    create(@Param("projectId") projectId: string, @Body() createApiKeyDto: CreateApiKeyDto) {
        return this.apiKeysService.create(projectId, createApiKeyDto);
    }

    @ApiOperation({ summary: "List project API keys (raw keys are never returned after creation)." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.apiKeysService.findAll(projectId);
    }

    @ApiOperation({ summary: "Revoke a project API key." })
    @Post(":apiKeyId/revoke")
    revoke(@Param("projectId") projectId: string, @Param("apiKeyId") apiKeyId: string) {
        return this.apiKeysService.revoke(projectId, apiKeyId);
    }
}
