import { ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerRequest } from "@nestjs/throttler";
import { hashToken } from "../../utils/hash-token.util";
import { ProjectApiKeyGuard } from "../project-api-key/project-api-key.guard";
import { ProjectThrottlerGuard } from "./project-throttler.guard";

// Stand-ins for the resolved route, so getHandler()/getClass() return the same
// references the reflector stub is asked about.
const routeHandler = () => undefined;
const routeController = () => undefined;

const spyOnSuper = () =>
    jest.spyOn(ThrottlerGuard.prototype, "handleRequest" as keyof ThrottlerGuard).mockResolvedValue(true as never);

describe("ProjectThrottlerGuard", () => {
    const findFirst = jest.fn();
    const prismaService = { client: { apiKey: { findFirst } } };
    const configService = {
        get: jest.fn((key: string) => (key === "PROJECT_THROTTLE_LIMIT" ? 600 : 60_000)),
    };
    const reflectorGet = jest.fn();

    let guard: ProjectThrottlerGuard;

    // getTracker/handleRequest are protected; cast to call them directly in
    // isolation without booting the full ThrottlerModule (storage/reflector are
    // irrelevant here).
    const tracker = (request: unknown) =>
        (guard as unknown as { getTracker(req: unknown): Promise<string> }).getTracker(request);
    const handleRequest = (requestProps: unknown) =>
        (guard as unknown as { handleRequest(props: unknown): Promise<boolean> }).handleRequest(requestProps);

    beforeEach(() => {
        findFirst.mockReset();
        configService.get.mockClear();
        reflectorGet.mockReset();
        reflectorGet.mockReturnValue(undefined);
        guard = new ProjectThrottlerGuard(
            [] as never, // ThrottlerModuleOptions — unused here, only exercised via canActivate
            { increment: jest.fn() } as never,
            { get: reflectorGet, getAllAndOverride: jest.fn() } as never,
            prismaService as never,
            configService as never,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

    it("resolves the api key once per request even when asked for the tracker repeatedly", async () => {
        findFirst.mockResolvedValue({ id: "key_abc" });
        const request = { headers: { authorization: "Bearer proj_key_123" }, ip: "1.2.3.4" };

        await tracker(request);
        await tracker(request);
        await tracker(request);

        expect(findFirst).toHaveBeenCalledTimes(1);
    });

    describe("budget selection", () => {
        const baseProps = {
            context: { getHandler: () => routeHandler, getClass: () => routeController },
            limit: 120,
            ttl: 60_000,
            throttler: { name: "default" },
        } as unknown as ThrottlerRequest;

        function stubRequest(request: unknown) {
            (guard as unknown as { getRequestResponse(context: unknown): unknown }).getRequestResponse = () => ({
                req: request,
                res: {},
            });
        }

        /** Mimics @UseGuards(ProjectApiKeyGuard) on the resolved route. */
        function routeGuardedByApiKey() {
            reflectorGet.mockImplementation((_key: string, target: unknown) =>
                typeof target === "function" ? [ProjectApiKeyGuard] : undefined,
            );
        }

        it("applies the public-API budget on a project-API-key route with a valid key", async () => {
            routeGuardedByApiKey();
            findFirst.mockResolvedValue({ id: "key_abc" });
            stubRequest({ headers: { authorization: "Bearer proj_key_123" }, ip: "1.2.3.4" });
            const superHandleRequest = spyOnSuper();

            await handleRequest(baseProps);

            expect(superHandleRequest).toHaveBeenCalledWith(
                expect.objectContaining({ limit: 600, ttl: 60_000, blockDuration: 60_000 }),
            );
        });

        it("leaves the dashboard budget alone for IP-tracked requests", async () => {
            routeGuardedByApiKey();
            findFirst.mockResolvedValue(null);
            stubRequest({ headers: {}, ip: "1.2.3.4" });
            const superHandleRequest = spyOnSuper();

            await handleRequest(baseProps);

            expect(superHandleRequest).toHaveBeenCalledWith(expect.objectContaining({ limit: 120, ttl: 60_000 }));
        });

        // The demo API key is handed out publicly by GET /demo/config, so a valid
        // key proves nothing about intent. Without this, anyone could attach it to
        // POST /auth/login and trade that route's 10-per-minute brute-force bound
        // for the public API's 600.
        it("does not raise the budget on a route that is not guarded by the api key guard", async () => {
            reflectorGet.mockReturnValue(undefined);
            findFirst.mockResolvedValue({ id: "key_abc" });
            stubRequest({ headers: { authorization: "Bearer proj_key_123" }, ip: "1.2.3.4" });
            const superHandleRequest = spyOnSuper();

            await handleRequest(baseProps);

            expect(superHandleRequest).toHaveBeenCalledWith(expect.objectContaining({ limit: 120, ttl: 60_000 }));
            expect(findFirst).not.toHaveBeenCalled();
        });
    });
});
