import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { PROJECT_API_KEY_SECURITY } from "../swagger";
import { WebhookDeliveryService } from "./deliveries.service";
import { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";

@ApiTags("Webhook Deliveries")
@ApiBearerAuth(PROJECT_API_KEY_SECURITY)
@UseGuards(ProjectApiKeyGuard)
@Controller("deliveries")
export class DeliveriesController {
    constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {}

    @ApiOperation({ summary: "List webhook delivery attempts for the authenticated project." })
    @Get()
    listDeliveries(@Req() request: AuthenticatedProjectRequest, @Query() query: ListDeliveriesQueryDto) {
        return this.webhookDeliveryService.listDeliveries(request.authProjectId, query);
    }
}
