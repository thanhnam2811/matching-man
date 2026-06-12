import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { MatchesService } from "./matches.service";

@UseGuards(ProjectApiKeyGuard)
@Controller("matches")
export class MatchesController {
    constructor(private readonly matchesService: MatchesService) {}

    @Get(":matchId")
    findOne(@Req() request: AuthenticatedProjectRequest, @Param("matchId") matchId: string) {
        return this.matchesService.findOne(request.authProjectId, matchId);
    }
}