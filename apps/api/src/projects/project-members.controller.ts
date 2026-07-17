import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateProjectMemberDto } from "./dto/create-project-member.dto";
import { UpdateProjectMemberDto } from "./dto/update-project-member.dto";
import { ProjectMembersService } from "./project-members.service";

@ApiTags("Project Members")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/members")
export class ProjectMembersController {
    constructor(private readonly projectMembersService: ProjectMembersService) {}

    @ApiOperation({ summary: "List project members." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.projectMembersService.findAll(projectId);
    }

    @ApiOperation({ summary: "Add a project member. Requires org ADMIN+ or project ADMIN+." })
    @Post()
    create(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Body() createProjectMemberDto: CreateProjectMemberDto,
    ) {
        return this.projectMembersService.create(toDashboardContext(request), projectId, createProjectMemberDto);
    }

    @ApiOperation({ summary: "Change a project member's role. Requires org ADMIN+ or project ADMIN+." })
    @Patch(":memberId")
    update(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("memberId") memberId: string,
        @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    ) {
        return this.projectMembersService.update(
            toDashboardContext(request),
            projectId,
            memberId,
            updateProjectMemberDto,
        );
    }

    @ApiOperation({
        summary: "Remove a member. Requires org ADMIN+ or project ADMIN+; a project must keep at least one owner.",
    })
    @Delete(":memberId")
    remove(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("memberId") memberId: string,
    ) {
        return this.projectMembersService.remove(toDashboardContext(request), projectId, memberId);
    }
}
