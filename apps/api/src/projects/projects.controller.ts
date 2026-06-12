import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectsService } from "./projects.service";

@UseGuards(DashboardAdminGuard)
@Controller("projects")
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) {}

    @Post()
    create(@Body() createProjectDto: CreateProjectDto) {
        return this.projectsService.create(createProjectDto);
    }

    @Get()
    findAll() {
        return this.projectsService.findAll();
    }

    @Get(":projectId")
    findOne(@Param("projectId") projectId: string) {
        return this.projectsService.findOne(projectId);
    }
}