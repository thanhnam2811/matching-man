import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { PROJECT_API_KEY_SECURITY } from "../swagger";
import { ListRatingHistoryQueryDto } from "./dto/list-rating-history-query.dto";
import { RatingsService } from "./ratings.service";

@ApiTags("Ratings")
@ApiBearerAuth(PROJECT_API_KEY_SECURITY)
@UseGuards(ProjectApiKeyGuard)
@Controller("ratings")
export class RatingsController {
    constructor(private readonly ratingsService: RatingsService) {}

    @ApiOperation({ summary: "Return paginated rating history (when internal_elo is enabled)." })
    @Get("history")
    listHistory(@Req() request: AuthenticatedProjectRequest, @Query() query: ListRatingHistoryQueryDto) {
        return this.ratingsService.listHistory(request.authProjectId, query);
    }
}
