import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";
import type { DashboardAuthRequest } from "../../interfaces/dashboard-auth-request";
import { SessionTokenService } from "../../../auth/session-token.service";

/**
 * Accepts either the shared dashboard admin token (super-admin / break-glass) or a
 * per-user session token. Attaches `authUserId` and `isSuperAdmin` to the request.
 */
@Injectable()
export class DashboardAuthGuard implements CanActivate {
    constructor(
        private readonly configService: ConfigService,
        private readonly sessionTokenService: SessionTokenService,
    ) {}

    canActivate(context: ExecutionContext) {
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

        request.authUserId = this.sessionTokenService.verify(token);
        request.isSuperAdmin = false;
        return true;
    }

    private constantTimeEquals(a: string, b: string): boolean {
        const left = Buffer.from(a);
        const right = Buffer.from(b);
        return left.length === right.length && timingSafeEqual(left, right);
    }
}
