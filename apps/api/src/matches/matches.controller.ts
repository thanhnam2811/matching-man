import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { PROJECT_API_KEY_SECURITY } from "../swagger";
import { CreateMatchDisputeDto } from "../disputes/dto/create-match-dispute.dto";
import { DisputesService } from "../disputes/disputes.service";
import { AcceptMatchDto } from "./dto/accept-match.dto";
import { DeclineMatchDto } from "./dto/decline-match.dto";
import { ReportResultDto } from "./dto/report-result.dto";
import { MatchesService } from "./matches.service";

@ApiTags("Matches")
@ApiBearerAuth(PROJECT_API_KEY_SECURITY)
@UseGuards(ProjectApiKeyGuard)
@Controller("matches")
export class MatchesController {
    constructor(
        private readonly matchesService: MatchesService,
        private readonly disputesService: DisputesService,
    ) {}

    @ApiOperation({ summary: "Return the current match state." })
    @Get(":matchId")
    findOne(@Req() request: AuthenticatedProjectRequest, @Param("matchId") matchId: string) {
        return this.matchesService.findOne(request.authProjectId, matchId);
    }

    @ApiOperation({ summary: "Accept a match during ready check handshake." })
    @Post(":matchId/accept")
    accept(
        @Req() request: AuthenticatedProjectRequest,
        @Param("matchId") matchId: string,
        @Body() dto: AcceptMatchDto,
    ) {
        return this.matchesService.acceptMatch(request.authProjectId, matchId, dto);
    }

    @ApiOperation({ summary: "Decline a match during ready check handshake." })
    @Post(":matchId/decline")
    decline(
        @Req() request: AuthenticatedProjectRequest,
        @Param("matchId") matchId: string,
        @Body() dto: DeclineMatchDto,
    ) {
        return this.matchesService.declineMatch(request.authProjectId, matchId, dto);
    }

    @ApiOperation({ summary: "Get current ready check countdown and participant acceptance status." })
    @Get(":matchId/ready-check")
    getReadyCheck(@Req() request: AuthenticatedProjectRequest, @Param("matchId") matchId: string) {
        return this.matchesService.getReadyCheckStatus(request.authProjectId, matchId);
    }

    @ApiOperation({ summary: "Report the final outcome of a match." })
    @Post(":matchId/report-result")
    reportResult(
        @Req() request: AuthenticatedProjectRequest,
        @Param("matchId") matchId: string,
        @Body() dto: ReportResultDto,
    ) {
        return this.matchesService.reportResult(request.authProjectId, matchId, dto);
    }

    @ApiOperation({ summary: "File a dispute against a match." })
    @Post(":matchId/dispute")
    createDispute(
        @Req() request: AuthenticatedProjectRequest,
        @Param("matchId") matchId: string,
        @Body() dto: CreateMatchDisputeDto,
    ) {
        return this.disputesService.createDispute(request.authProjectId, matchId, dto);
    }
}
