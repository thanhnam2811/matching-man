import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { DashboardAuthRequest } from "../../interfaces/dashboard-auth-request";
import { SessionTokenService } from "../../../auth/session-token.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

/**
 * Accepts either the shared dashboard admin token (super-admin / break-glass) or a
 * per-user session token. Attaches `authUserId` and `isSuperAdmin` to the request.
 */
@Injectable()
export class DashboardAuthGuard implements CanActivate {
    constructor(
        private readonly configService: ConfigService,
        private readonly sessionTokenService: SessionTokenService,
        private readonly prismaService: PrismaService,
        private readonly redisService?: RedisService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<DashboardAuthRequest>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing authorization");
        }

        const token = authorization.slice("Bearer ".length).trim();
        if (!token) {
            throw new UnauthorizedException("Missing authorization");
        }

        const adminToken = this.configService.get<string>("DASHBOARD_ADMIN_TOKEN");
        if (adminToken && this.constantTimeEquals(token, adminToken)) {
            request.isSuperAdmin = true;
            return true;
        }

        const { userId, tokenVersion } = this.sessionTokenService.verifyPayload(token);

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
        request.isSuperAdmin = false;
        return true;
    }

    private constantTimeEquals(a: string, b: string): boolean {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        return left.length === right.length && timingSafeEqual(left, right);
    }
}
