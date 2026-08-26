import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { PenaltiesController } from "./penalties.controller";
import { PenaltiesService } from "./penalties.service";

@Module({
    imports: [PrismaModule, DeliveriesModule],
    controllers: [PenaltiesController],
    providers: [PenaltiesService],
    exports: [PenaltiesService],
})
export class PenaltiesModule {}
