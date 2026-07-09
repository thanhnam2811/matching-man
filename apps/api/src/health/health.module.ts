import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulerHealthModule } from "../common/scheduler-health/scheduler-health.module";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
    imports: [PrismaModule, SchedulerHealthModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
