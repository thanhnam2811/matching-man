import { Injectable } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { ConfigService } from "@nestjs/config";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerModuleOptions, ThrottlerRequest, ThrottlerStorage } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { hashToken } from "../../utils/hash-token.util";
import { ProjectApiKeyGuard } from "../project-api-key/project-api-key.guard";

const RESOLVED_TRACKER = Symbol("resolvedTracker");

type TrackedRequest = {
    headers: { authorization?: string };
    ip: string;
    [RESOLVED_TRACKER]?: string;
};

const API_KEY_TRACKER_PREFIX = "key:";

@Injectable()
export class ProjectThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        private readonly prismaService: PrismaService,
        private readonly configService: ConfigService,
    ) {
        super(options, storageService, reflector);
    }

    // Only a token that resolves to a real, non-revoked API key is trusted as a
    // rate-limit identity. An unverified/invalid token falls back to client IP,
    // so an attacker can't dodge the limit by sending a different bogus token on
    // every request — each guess still accumulates against their IP.
    //
    // The result is memoized on the request: handleRequest needs to know whether
    // this is API-key traffic before delegating, and the base class then asks for
    // the tracker again. Without the cache that is two identical key lookups per
    // request on the hottest path in the system.
    protected async getTracker(req: TrackedRequest): Promise<string> {
        const cached = req[RESOLVED_TRACKER];
        if (cached !== undefined) {
            return cached;
        }

        const tracker = await this.resolveTracker(req);
        req[RESOLVED_TRACKER] = tracker;
        return tracker;
    }

    private async resolveTracker(req: TrackedRequest): Promise<string> {
        const authorization = req.headers.authorization;

        if (authorization?.startsWith("Bearer ")) {
            const token = authorization.slice("Bearer ".length).trim();

            if (token) {
                const apiKey = await this.prismaService.client.apiKey.findFirst({
                    where: { hashedKey: hashToken(token), isRevoked: false },
                    select: { id: true },
                });

                if (apiKey) {
                    return `${API_KEY_TRACKER_PREFIX}${apiKey.id}`;
                }
            }
        }

        return req.ip;
    }

    /**
     * The public API gets its own budget: a game server enqueueing players
     * sustains orders of magnitude more requests than a browser session, so a
     * single shared limit either throttles the integration or over-serves the
     * dashboard.
     *
     * The decision is made from the *route*, not the caller. Keying it off "does
     * this request carry a valid API key" would let anyone attach a key to
     * `POST /auth/login` and trade that route's deliberate 10-per-minute
     * brute-force bound for 600 — and the demo key is handed out publicly by
     * `GET /demo/config`, so the key is not a secret. Only routes actually
     * authenticated by ProjectApiKeyGuard are public-API routes; everything else
     * keeps whatever the module config or a route-level @Throttle decided.
     *
     * Everything else — key generation, storage, headers, the 429 itself — stays
     * with the base guard; only the budget is swapped.
     */
    protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        if (!this.isProjectApiKeyRoute(requestProps.context)) {
            return super.handleRequest(requestProps);
        }

        const { req } = this.getRequestResponse(requestProps.context);
        const tracker = await this.getTracker(req as TrackedRequest);

        if (!tracker.startsWith(API_KEY_TRACKER_PREFIX)) {
            return super.handleRequest(requestProps);
        }

        const ttl = this.configService.get<number>("PROJECT_THROTTLE_TTL_MS")!;

        return super.handleRequest({
            ...requestProps,
            limit: this.configService.get<number>("PROJECT_THROTTLE_LIMIT")!,
            ttl,
            // Mirrors the library's own default of blocking for one window. Left
            // untouched, an over-limit key would be blocked for the dashboard
            // window while the response headers advertise the project one.
            blockDuration: ttl,
        });
    }

    private isProjectApiKeyRoute(context: ExecutionContext): boolean {
        const guards = [
            ...(this.reflector.get<unknown[]>(GUARDS_METADATA, context.getHandler()) ?? []),
            ...(this.reflector.get<unknown[]>(GUARDS_METADATA, context.getClass()) ?? []),
        ];

        return guards.some((guard) => guard === ProjectApiKeyGuard || guard instanceof ProjectApiKeyGuard);
    }
}
