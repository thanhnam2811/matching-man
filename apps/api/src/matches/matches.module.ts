import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { DisputesModule } from "../disputes/disputes.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { RatingsModule } from "../ratings/ratings.module";
import { PenaltiesModule } from "../penalties/penalties.module";
import { QueuesModule } from "../queues/queues.module";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { ReadyCheckTimeoutProcessor } from "./ready-check-timeout.processor";

@Module({
    imports: [
        PrismaModule,
        DeliveriesModule,
        RatingsModule,
        DisputesModule,
        PenaltiesModule,
        QueuesModule,
        BullModule.registerQueue({
            name: "ready-check-timeout",
        }),
    ],
    providers: [MatchesService, ReadyCheckTimeoutProcessor, ProjectApiKeyGuard],
    controllers: [MatchesController],
    exports: [MatchesService],
})
export class MatchesModule {}
