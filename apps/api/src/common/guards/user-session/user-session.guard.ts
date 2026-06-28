import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AuthenticatedUserRequest } from "../../interfaces/authenticated-user-request";
import { SessionTokenService } from "../../../auth/session-token.service";

@Injectable()
export class UserSessionGuard implements CanActivate {
    constructor(private readonly sessionTokenService: SessionTokenService) {}

    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<AuthenticatedUserRequest>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing session token");
        }

        request.authUserId = this.sessionTokenService.verify(authorization.slice("Bearer ".length).trim());

        return true;
    }
}
