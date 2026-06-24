import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@UseGuards(DashboardAuthGuard)
@Controller("projects")
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    @Post()
    create(@Req() request: DashboardAuthRequest, @Body() createProjectDto: CreateProjectDto) {
        return this.projectsService.create(toDashboardContext(request), createProjectDto);
    }

    @Get()
    findAll(@Req() request: DashboardAuthRequest) {
        return this.projectsService.findAll(toDashboardContext(request));
    }

    @Get(":projectId")
    findOne(@Req() request: DashboardAuthRequest, @Param("projectId") projectId: string) {
        return this.projectsService.findOne(toDashboardContext(request), projectId);
    }
}