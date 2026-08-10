import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerModuleOptions, ThrottlerRequest, ThrottlerStorage } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { hashToken } from "../../utils/hash-token.util";

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
     * Requests carrying a valid project API key get the public-API budget rather
     * than the dashboard one. A game server enqueueing players sustains orders of
     * magnitude more requests than a browser session, so a single shared limit
     * either throttles the integration or over-serves the dashboard.
     *
     * Everything else — key generation, storage, headers, the 429 itself — stays
     * with the base guard; only the budget is swapped.
     */
    protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
        const { req } = this.getRequestResponse(requestProps.context);
        const tracker = await this.getTracker(req as TrackedRequest);

        if (!tracker.startsWith(API_KEY_TRACKER_PREFIX)) {
            return super.handleRequest(requestProps);
        }

        return super.handleRequest({
            ...requestProps,
            limit: this.configService.get<number>("PROJECT_THROTTLE_LIMIT")!,
            ttl: this.configService.get<number>("PROJECT_THROTTLE_TTL_MS")!,
        });
    }
}
