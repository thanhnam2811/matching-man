import { Injectable } from "@nestjs/common";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard } from "@nestjs/throttler";
import type { ThrottlerModuleOptions, ThrottlerStorage } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../../prisma/prisma.service";
import { hashToken } from "../../utils/hash-token.util";

type TrackedRequest = {
    headers: { authorization?: string };
    ip: string;
};

@Injectable()
export class ProjectThrottlerGuard extends ThrottlerGuard {
    constructor(
        @InjectThrottlerOptions() options: ThrottlerModuleOptions,
        @InjectThrottlerStorage() storageService: ThrottlerStorage,
        reflector: Reflector,
        private readonly prismaService: PrismaService,
    ) {
        super(options, storageService, reflector);
    }

    // Only a token that resolves to a real, non-revoked API key is trusted as a
    // rate-limit identity. An unverified/invalid token falls back to client IP,
    // so an attacker can't dodge the limit by sending a different bogus token on
    // every request — each guess still accumulates against their IP.
    protected async getTracker(req: TrackedRequest): Promise<string> {
        const authorization = req.headers.authorization;

        if (authorization?.startsWith("Bearer ")) {
            const token = authorization.slice("Bearer ".length).trim();

            if (token) {
                const apiKey = await this.prismaService.client.apiKey.findFirst({
                    where: { hashedKey: hashToken(token), isRevoked: false },
                    select: { id: true },
                });

                if (apiKey) {
                    return `key:${apiKey.id}`;
                }
            }
        }

        return req.ip;
    }
}
