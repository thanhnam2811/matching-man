import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedUserRequest } from "../../interfaces/authenticated-user-request";
import { SessionTokenService } from "../../../auth/session-token.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class UserSessionGuard implements CanActivate {
    constructor(
        private readonly sessionTokenService: SessionTokenService,
        private readonly prismaService: PrismaService,
        private readonly redisService?: RedisService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing session token");
        }

        const rawToken = authorization.slice("Bearer ".length).trim();
        const { userId, tokenVersion } = this.sessionTokenService.verifyPayload(rawToken);

        // Fast-path: check cached tokenVersion in Redis if available
        let currentVersion: number | null = null;
        if (this.redisService?.client) {
            try {
                const cached = await this.redisService.client.get(`user:token_version:${userId}`);
                if (cached !== null) {
                    currentVersion = Number(cached);
                }
            } catch {
                // Redis unavailable, fallback to DB
            }
        }

        if (currentVersion === null) {
            const user = await this.prismaService.client.user.findUnique({
                where: { id: userId },
                select: { tokenVersion: true },
            });
            if (!user) {
                throw new UnauthorizedException("User not found");
            }
            currentVersion = user.tokenVersion;

            if (this.redisService?.client) {
                this.redisService.client
                    .set(`user:token_version:${userId}`, String(currentVersion), "EX", 3600)
                    .catch(() => {});
            }
        }

        if (currentVersion !== tokenVersion) {
            throw new UnauthorizedException("Session revoked. Please sign in again.");
        }

        request.authUserId = userId;
        return true;
    }
}
