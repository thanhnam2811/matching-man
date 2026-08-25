import { Module } from "@nestjs/common";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RatingsModule } from "../ratings/ratings.module";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";

@Module({
    imports: [PrismaModule, DeliveriesModule, RatingsModule],
    controllers: [DisputesController],
    providers: [DisputesService],
    exports: [DisputesService],
})
export class DisputesModule {}
