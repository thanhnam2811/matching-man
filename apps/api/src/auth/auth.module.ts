import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { PasswordService } from "./password.service";
import { SessionTokenService } from "./session-token.service";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { UserSessionGuard } from "../common/guards/user-session/user-session.guard";

@Global()
@Module({
    imports: [PrismaModule],
    providers: [
        AuthService,
        PasswordService,
        SessionTokenService,
        DashboardAdminGuard,
        DashboardAuthGuard,
        UserSessionGuard,
    ],
    controllers: [AuthController],
    exports: [AuthService, SessionTokenService, DashboardAdminGuard, DashboardAuthGuard, UserSessionGuard],
})
export class AuthModule {}