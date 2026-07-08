import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateProjectEnvironmentDto } from "./dto/create-project-environment.dto";
import { UpdateProjectEnvironmentDto } from "./dto/update-project-environment.dto";
import { ProjectEnvironmentsService } from "./project-environments.service";

@ApiTags("Project Environments")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/environments")
export class ProjectEnvironmentsController {
    constructor(private readonly projectEnvironmentsService: ProjectEnvironmentsService) {}

    @ApiOperation({ summary: "List project environments." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.projectEnvironmentsService.findAll(projectId);
    }

    @ApiOperation({ summary: "Create a project environment." })
    @Post()
    create(@Param("projectId") projectId: string, @Body() createProjectEnvironmentDto: CreateProjectEnvironmentDto) {
        return this.projectEnvironmentsService.create(projectId, createProjectEnvironmentDto);
    }

    @ApiOperation({ summary: "Update a project environment." })
    @Patch(":environmentId")
    update(
        @Param("projectId") projectId: string,
        @Param("environmentId") environmentId: string,
        @Body() updateProjectEnvironmentDto: UpdateProjectEnvironmentDto,
    ) {
        return this.projectEnvironmentsService.update(projectId, environmentId, updateProjectEnvironmentDto);
    }

    @ApiOperation({ summary: "Delete a project environment." })
    @Delete(":environmentId")
    remove(@Param("projectId") projectId: string, @Param("environmentId") environmentId: string) {
        return this.projectEnvironmentsService.remove(projectId, environmentId);
    }
}
