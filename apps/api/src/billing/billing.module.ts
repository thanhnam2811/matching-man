import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MeteringModule } from "../metering/metering.module";
import { EmailModule } from "../email/email.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { BillingService } from "./billing.service";
import { BillingWebhookService } from "./billing-webhook.service";
import { BillingController } from "./billing.controller";

@Module({
    imports: [PrismaModule, MeteringModule, EmailModule, OrganizationsModule],
    providers: [BillingService, BillingWebhookService],
    controllers: [BillingController],
    exports: [BillingService, BillingWebhookService],
})
export class BillingModule {}
