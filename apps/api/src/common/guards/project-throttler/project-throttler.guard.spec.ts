import { hashToken } from "../../utils/hash-token.util";
import { ProjectThrottlerGuard } from "./project-throttler.guard";

describe("ProjectThrottlerGuard", () => {
    const findFirst = jest.fn();
    const prismaService = { client: { apiKey: { findFirst } } };

    // getTracker is protected; cast to call it directly in isolation without
    // booting the full ThrottlerModule (storage/reflector are irrelevant here).
    const guard = new ProjectThrottlerGuard(
        [] as never, // ThrottlerModuleOptions — unused by getTracker, only exercised via canActivate
        { increment: jest.fn() } as never,
        { getAllAndOverride: jest.fn() } as never,
        prismaService as never,
    );
    const tracker = (request: unknown) =>
        (guard as unknown as { getTracker(req: unknown): Promise<string> }).getTracker(request);

    beforeEach(() => {
        findFirst.mockReset();
    });

    it("keys on the api key id when the bearer token resolves to a non-revoked key", async () => {
        findFirst.mockResolvedValue({ id: "key_abc" });

        const result = await tracker({ headers: { authorization: "Bearer proj_key_123" }, ip: "1.2.3.4" });

        expect(result).toBe("key:key_abc");
        expect(findFirst).toHaveBeenCalledWith({
            where: { hashedKey: hashToken("proj_key_123"), isRevoked: false },
            select: { id: true },
        });
    });

    it("falls back to client IP when the bearer token does not resolve to a known key", async () => {
        findFirst.mockResolvedValue(null);

        const result = await tracker({ headers: { authorization: "Bearer guessed-token" }, ip: "1.2.3.4" });

        expect(result).toBe("1.2.3.4");
    });

    it("falls back to client IP when there is no Authorization header", async () => {
        const result = await tracker({ headers: {}, ip: "5.6.7.8" });

        expect(result).toBe("5.6.7.8");
        expect(findFirst).not.toHaveBeenCalled();
    });

    it("falls back to client IP for a malformed Authorization header", async () => {
        const result = await tracker({ headers: { authorization: "Basic xyz" }, ip: "9.9.9.9" });

        expect(result).toBe("9.9.9.9");
        expect(findFirst).not.toHaveBeenCalled();
    });
});
