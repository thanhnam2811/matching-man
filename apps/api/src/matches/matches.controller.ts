import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { PROJECT_API_KEY_SECURITY } from "../swagger";
import { CreateMatchDisputeDto } from "../disputes/dto/create-match-dispute.dto";
import { DisputesService } from "../disputes/disputes.service";
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
