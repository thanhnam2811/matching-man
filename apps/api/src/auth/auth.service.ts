import { Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

@Injectable()
export class AuthService {
    constructor(private readonly configService: ConfigService) {}

    getContract() {
        return {
            dashboardAuth: {
                type: "bearer_token",
                status: "active",
            },
            projectApiAuth: {
                type: "bearer_api_key",
                status: "active_design",
            },
        };
    }

    assertDashboardAdminAuthorization(authorization?: string) {
        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing dashboard admin bearer token");
        }

        const providedToken = authorization.slice("Bearer ".length).trim();

        if (!providedToken) {
            throw new UnauthorizedException("Missing dashboard admin bearer token");
        }

        const expectedToken = this.configService.get<string>("DASHBOARD_ADMIN_TOKEN");

        if (!expectedToken) {
            throw new InternalServerErrorException("DASHBOARD_ADMIN_TOKEN is not configured");
        }

        const providedBuffer = Buffer.from(providedToken);
        const expectedBuffer = Buffer.from(expectedToken);

        if (
            providedBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(providedBuffer, expectedBuffer)
        ) {
            throw new UnauthorizedException("Invalid dashboard admin bearer token");
        }
    }
}
