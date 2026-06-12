import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { WebhookDeliveryService } from "./deliveries.service";
import { WebhookRetryProcessor } from "./webhook-retry.processor";
import { DeliveriesController } from "./deliveries.controller";

@Module({
    imports: [PrismaModule],
    providers: [WebhookDeliveryService, WebhookRetryProcessor, ProjectApiKeyGuard],
    controllers: [DeliveriesController],
    exports: [WebhookDeliveryService],
})
export class DeliveriesModule {}