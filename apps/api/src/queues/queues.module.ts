import { Module } from "@nestjs/common";
import { QueuesService } from "./queues.service";
import { QueuesController } from "./queues.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { GameModesModule } from "../game-modes/game-modes.module";
import { ProjectsModule } from "../projects/projects.module";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { QueueTimeoutProcessor } from "./queue-timeout.processor";

@Module({
    imports: [PrismaModule, GameModesModule, ProjectsModule, DeliveriesModule],
    providers: [QueuesService, QueueTimeoutProcessor, ProjectApiKeyGuard],
    controllers: [QueuesController],
})
export class QueuesModule {}