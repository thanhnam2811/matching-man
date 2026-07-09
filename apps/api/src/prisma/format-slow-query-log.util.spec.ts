import { formatSlowQueryLog } from "./format-slow-query-log.util";

describe("formatSlowQueryLog", () => {
    it("returns null when the query is faster than the threshold", () => {
        expect(formatSlowQueryLog({ query: "SELECT 1", duration: 50 }, 200)).toBeNull();
    });

    it("formats a structured log entry when the query meets the threshold", () => {
        const result = formatSlowQueryLog({ query: "SELECT * FROM matches", duration: 250 }, 200);

        expect(result).toEqual({
            event: "slow_query",
            durationMs: 250,
            query: "SELECT * FROM matches",
        });
    });
});
