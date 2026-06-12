import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { WebhookDeliveryService } from "./deliveries.service";
import { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";

@UseGuards(ProjectApiKeyGuard)
@Controller("deliveries")
export class DeliveriesController {
    constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {}

    @Get()
    listDeliveries(@Req() request: AuthenticatedProjectRequest, @Query() query: ListDeliveriesQueryDto) {
        return this.webhookDeliveryService.listDeliveries(request.authProjectId, query);
    }
}