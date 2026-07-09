import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SCHEDULER_JOBS, SchedulerHealthService } from "../common/scheduler-health/scheduler-health.service";
import { DemoService } from "./demo.service";

@Injectable()
export class DemoResetProcessor {
    private readonly logger = new Logger(DemoResetProcessor.name);

    constructor(
        private readonly demoService: DemoService,
        private readonly schedulerHealthService: SchedulerHealthService,
    ) {}

    // Runs every minute but only reseeds once DEMO_RESET_INTERVAL_MINUTES has
    // elapsed since the last reset (tracked in system_settings), so the interval
    // stays env-configurable without a dynamic cron expression.
    @Cron("30 * * * * *")
    async processDemoReset() {
        this.schedulerHealthService.recordRun(SCHEDULER_JOBS.DEMO_RESET);

        try {
            await this.demoService.resetIfDue();
        } catch (err) {
            this.logger.error("Failed to reset demo data", err);
        }
    }
}
