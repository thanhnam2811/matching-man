import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { DisputesService } from "./disputes.service";
import { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import { RejectDisputeDto } from "./dto/reject-dispute.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

@ApiTags("Disputes")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/disputes")
export class DisputesController {
    constructor(private readonly disputesService: DisputesService) {}

    @ApiOperation({ summary: "List match disputes for a project with optional status filter." })
    @Get()
    findAll(@Param("projectId") projectId: string, @Query() query: ListDisputesQueryDto) {
        return this.disputesService.findAll(projectId, query);
    }

    @ApiOperation({ summary: "Get detailed dispute information including match slots and evidence." })
    @Get(":disputeId")
    findOne(@Param("projectId") projectId: string, @Param("disputeId") disputeId: string) {
        return this.disputesService.findOne(projectId, disputeId);
    }

    @ApiOperation({ summary: "Resolve a dispute with optional winner override and Elo rating reconciliation." })
    @Post(":disputeId/resolve")
    resolve(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("disputeId") disputeId: string,
        @Body() dto: ResolveDisputeDto,
    ) {
        return this.disputesService.resolveDispute(toDashboardContext(request), projectId, disputeId, dto);
    }

    @ApiOperation({ summary: "Reject a dispute and restore match status." })
    @Post(":disputeId/reject")
    reject(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("disputeId") disputeId: string,
        @Body() dto: RejectDisputeDto,
    ) {
        return this.disputesService.rejectDispute(toDashboardContext(request), projectId, disputeId, dto);
    }
}
