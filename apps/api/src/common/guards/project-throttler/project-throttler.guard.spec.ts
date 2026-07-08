import { hashToken } from "../../utils/hash-token.util";
import { ProjectThrottlerGuard } from "./project-throttler.guard";

describe("ProjectThrottlerGuard", () => {
    // getTracker is protected; cast to call it directly in isolation without
    // booting the full ThrottlerModule (storage/reflector are irrelevant here).
    const guard = new ProjectThrottlerGuard(
        [] as never, // ThrottlerModuleOptions — unused by getTracker, only exercised via canActivate
        { increment: jest.fn() } as never,
        { getAllAndOverride: jest.fn() } as never,
    );
    const tracker = (request: unknown) =>
        (guard as unknown as { getTracker(req: unknown): Promise<string> }).getTracker(request);

    it("keys on the hashed bearer token when Authorization is present", async () => {
        const result = await tracker({ headers: { authorization: "Bearer proj_key_123" }, ip: "1.2.3.4" });

        expect(result).toBe(hashToken("proj_key_123"));
    });

    it("falls back to client IP when there is no Authorization header", async () => {
        const result = await tracker({ headers: {}, ip: "5.6.7.8" });

        expect(result).toBe("5.6.7.8");
    });

    it("falls back to client IP for a malformed Authorization header", async () => {
        const result = await tracker({ headers: { authorization: "Basic xyz" }, ip: "9.9.9.9" });

        expect(result).toBe("9.9.9.9");
    });
});
