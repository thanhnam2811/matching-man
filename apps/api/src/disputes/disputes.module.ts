import { Module } from "@nestjs/common";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DisputesService } from "./disputes.service";

@Module({
    imports: [PrismaModule, DeliveriesModule],
    providers: [DisputesService],
    exports: [DisputesService],
})
export class DisputesModule {}
