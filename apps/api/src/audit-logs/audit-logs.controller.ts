import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { ProjectMemberRole } from "../generated/prisma/client";
import { OrganizationsService } from "../organizations/organizations.service";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { AuditLogService } from "./audit-logs.service";
import { AuditLogQueryDto } from "./dto/audit-log-query.dto";

@ApiTags("Audit Logs")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard)
@Controller()
export class AuditLogsController {
    constructor(
        private readonly auditLogService: AuditLogService,
        private readonly organizationsService: OrganizationsService,
    ) {}

    @ApiOperation({ summary: "Get paginated audit logs for a project." })
    @UseGuards(ProjectAccessGuard)
    @Get("projects/:projectId/audit-logs")
    getProjectLogs(@Param("projectId") projectId: string, @Query() query: AuditLogQueryDto) {
        return this.auditLogService.findProjectLogs(projectId, query);
    }

    @ApiOperation({ summary: "Get paginated audit logs across an organization." })
    @Get("organizations/:id/audit-logs")
    async getOrganizationLogs(
        @Param("id") organizationId: string,
        @Req() req: DashboardAuthRequest,
        @Query() query: AuditLogQueryDto,
    ) {
        await this.organizationsService.assertAccess(toDashboardContext(req), organizationId, ProjectMemberRole.MEMBER);
        return this.auditLogService.findOrganizationLogs(organizationId, query);
    }
}
