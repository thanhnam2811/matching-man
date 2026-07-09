import { Module } from "@nestjs/common";
import { QueuesService } from "./queues.service";
import { QueuesController } from "./queues.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulerHealthModule } from "../common/scheduler-health/scheduler-health.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { GameModesModule } from "../game-modes/game-modes.module";
import { ProjectsModule } from "../projects/projects.module";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { QueueTimeoutProcessor } from "./queue-timeout.processor";
import { MatchMakerSweepProcessor } from "./match-maker-sweep.processor";

@Module({
    imports: [PrismaModule, GameModesModule, ProjectsModule, DeliveriesModule, SchedulerHealthModule],
    providers: [QueuesService, QueueTimeoutProcessor, MatchMakerSweepProcessor, ProjectApiKeyGuard],
    controllers: [QueuesController],
    exports: [QueuesService],
})
export class QueuesModule {}
