import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { ListRatingHistoryQueryDto } from "./dto/list-rating-history-query.dto";
import { RatingsService } from "./ratings.service";

@UseGuards(ProjectApiKeyGuard)
@Controller("ratings")
export class RatingsController {
    constructor(private readonly ratingsService: RatingsService) {}

    @Get("history")
    listHistory(@Req() request: AuthenticatedProjectRequest, @Query() query: ListRatingHistoryQueryDto) {
        return this.ratingsService.listHistory(request.authProjectId, query);
    }
}
