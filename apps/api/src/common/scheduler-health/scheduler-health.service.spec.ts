import { SchedulerHealthService } from "./scheduler-health.service";

describe("SchedulerHealthService", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("reports pending when a job has never run", () => {
        const service = new SchedulerHealthService();

        expect(service.getStatus("webhook-retry", 90_000)).toBe("pending");
    });

    it("reports up when the last run is within the staleness window", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
        const service = new SchedulerHealthService();

        service.recordRun("webhook-retry");
        jest.setSystemTime(new Date("2026-06-12T00:01:00.000Z"));

        expect(service.getStatus("webhook-retry", 90_000)).toBe("up");
    });

    it("reports down when the last run is older than the staleness window", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
        const service = new SchedulerHealthService();

        service.recordRun("webhook-retry");
        jest.setSystemTime(new Date("2026-06-12T00:02:00.000Z"));

        expect(service.getStatus("webhook-retry", 90_000)).toBe("down");
    });

    it("tracks each job independently", () => {
        const service = new SchedulerHealthService();

        service.recordRun("webhook-retry");

        expect(service.getStatus("queue-timeout", 90_000)).toBe("pending");
    });
});
