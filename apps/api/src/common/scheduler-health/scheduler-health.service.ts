import { Injectable } from "@nestjs/common";

export const SCHEDULER_JOBS = {
    WEBHOOK_RETRY: "webhook-retry",
    QUEUE_TIMEOUT: "queue-timeout",
    MATCH_MAKER_SWEEP: "match-maker-sweep",
    DEMO_RESET: "demo-reset",
} as const;

export type SchedulerJobName = (typeof SCHEDULER_JOBS)[keyof typeof SCHEDULER_JOBS];
export type SchedulerJobStatus = "pending" | "up" | "down";

@Injectable()
export class SchedulerHealthService {
    private readonly lastRunAt = new Map<SchedulerJobName, Date>();

    recordRun(job: SchedulerJobName): void {
        this.lastRunAt.set(job, new Date());
    }

    getStatus(job: SchedulerJobName, staleAfterMs: number): SchedulerJobStatus {
        const lastRun = this.lastRunAt.get(job);

        if (!lastRun) {
            return "pending";
        }

        return Date.now() - lastRun.getTime() <= staleAfterMs ? "up" : "down";
    }
}
