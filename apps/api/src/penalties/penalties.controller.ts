import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateManualPenaltyDto } from "./dto/create-manual-penalty.dto";
import { QueryPenaltiesDto } from "./dto/query-penalties.dto";
import { PenaltiesService } from "./penalties.service";

@ApiTags("Penalties")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard)
@Controller("projects/:projectId/penalties")
export class PenaltiesController {
    constructor(private readonly penaltiesService: PenaltiesService) {}

    @ApiOperation({ summary: "List player penalties for a project." })
    @Get()
    list(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Query() query: QueryPenaltiesDto,
    ) {
        return this.penaltiesService.listPenalties(toDashboardContext(request), projectId, query);
    }

    @ApiOperation({ summary: "Manually issue a penalty/lockout for a player." })
    @Post()
    createManual(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Body() dto: CreateManualPenaltyDto,
    ) {
        return this.penaltiesService.createManualPenalty(toDashboardContext(request), projectId, dto);
    }

    @ApiOperation({ summary: "Pardon / Revoke an active player penalty." })
    @Delete(":penaltyId")
    pardon(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("penaltyId") penaltyId: string,
        @Body("notes") notes?: string,
    ) {
        return this.penaltiesService.pardonPenalty(toDashboardContext(request), projectId, penaltyId, notes);
    }
}
