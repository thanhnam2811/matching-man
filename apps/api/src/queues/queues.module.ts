import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QueuesService } from "./queues.service";
import { QueuesController } from "./queues.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulerHealthModule } from "../common/scheduler-health/scheduler-health.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { GameModesModule } from "../game-modes/game-modes.module";
import { ProjectsModule } from "../projects/projects.module";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { PenaltiesModule } from "../penalties/penalties.module";
import { QueueTimeoutProcessor } from "./queue-timeout.processor";
import { MatchMakerSweepProcessor } from "./match-maker-sweep.processor";

@Module({
    imports: [
        PrismaModule,
        GameModesModule,
        ProjectsModule,
        DeliveriesModule,
        PenaltiesModule,
        SchedulerHealthModule,
        BullModule.registerQueue({
            name: "queue-timeout",
        }),
        BullModule.registerQueue({
            name: "matchmaking-pool",
        }),
        BullModule.registerQueue({
            name: "ready-check-timeout",
        }),
    ],
    providers: [QueuesService, QueueTimeoutProcessor, MatchMakerSweepProcessor, ProjectApiKeyGuard],
    controllers: [QueuesController],
    exports: [QueuesService, BullModule],
})
export class QueuesModule {}
