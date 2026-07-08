import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("Projects")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard)
@Controller("projects")
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    @ApiOperation({ summary: "Create a project inside an organization the caller belongs to." })
    @Post()
    create(@Req() request: DashboardAuthRequest, @Body() createProjectDto: CreateProjectDto) {
        return this.projectsService.create(toDashboardContext(request), createProjectDto);
    }

    @ApiOperation({ summary: "List projects visible to the caller." })
    @Get()
    findAll(@Req() request: DashboardAuthRequest) {
        return this.projectsService.findAll(toDashboardContext(request));
    }

    @ApiOperation({ summary: "Get a single project." })
    @Get(":projectId")
    findOne(@Req() request: DashboardAuthRequest, @Param("projectId") projectId: string) {
        return this.projectsService.findOne(toDashboardContext(request), projectId);
    }
}
