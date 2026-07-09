import { Module } from "@nestjs/common";
import { SchedulerHealthService } from "./scheduler-health.service";

@Module({
    providers: [SchedulerHealthService],
    exports: [SchedulerHealthService],
})
export class SchedulerHealthModule {}
