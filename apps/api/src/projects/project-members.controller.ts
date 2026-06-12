import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { CreateProjectMemberDto } from "./dto/create-project-member.dto";
import { UpdateProjectMemberDto } from "./dto/update-project-member.dto";
import { ProjectMembersService } from "./project-members.service";

@UseGuards(DashboardAdminGuard)
@Controller("projects/:projectId/members")
export class ProjectMembersController {
    constructor(private readonly projectMembersService: ProjectMembersService) {}

    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.projectMembersService.findAll(projectId);
    }

    @Post()
    create(@Param("projectId") projectId: string, @Body() createProjectMemberDto: CreateProjectMemberDto) {
        return this.projectMembersService.create(projectId, createProjectMemberDto);
    }

    @Patch(":memberId")
    update(
        @Param("projectId") projectId: string,
        @Param("memberId") memberId: string,
        @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    ) {
        return this.projectMembersService.update(projectId, memberId, updateProjectMemberDto);
    }

    @Delete(":memberId")
    remove(@Param("projectId") projectId: string, @Param("memberId") memberId: string) {
        return this.projectMembersService.remove(projectId, memberId);
    }
}