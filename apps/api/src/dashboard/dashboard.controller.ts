import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { ListDeliveriesQueryDto } from "../deliveries/dto/list-deliveries-query.dto";
import { ListMatchesQueryDto } from "../matches/dto/list-matches-query.dto";
import { MatchesService } from "../matches/matches.service";
import { ListRatingHistoryQueryDto } from "../ratings/dto/list-rating-history-query.dto";
import { RatingsService } from "../ratings/ratings.service";
import { QueuesService } from "../queues/queues.service";

@UseGuards(DashboardAdminGuard)
@Controller("projects/:projectId")
export class DashboardController {
    constructor(
        private readonly queuesService: QueuesService,
        private readonly matchesService: MatchesService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
        private readonly ratingsService: RatingsService,
    ) {}

    @Get("pools")
    listPools(@Param("projectId") projectId: string) {
        return this.queuesService.listPools(projectId);
    }

    @Get("matches")
    listMatches(@Param("projectId") projectId: string, @Query() query: ListMatchesQueryDto) {
        return this.matchesService.listMatches(projectId, query);
    }

    @Get("webhook-deliveries")
    listDeliveries(@Param("projectId") projectId: string, @Query() query: ListDeliveriesQueryDto) {
        return this.webhookDeliveryService.listDeliveries(projectId, query);
    }

    @Get("rating-history")
    listRatingHistory(@Param("projectId") projectId: string, @Query() query: ListRatingHistoryQueryDto) {
        return this.ratingsService.listHistory(projectId, query);
    }
}