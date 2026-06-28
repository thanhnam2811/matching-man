import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "../../../auth/auth.service";

@Injectable()
export class DashboardAdminGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();

        this.authService.assertDashboardAdminAuthorization(request.headers.authorization);

        return true;
    }
}
