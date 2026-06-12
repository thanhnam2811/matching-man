import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";

@Global()
@Module({
    providers: [AuthService, DashboardAdminGuard],
    controllers: [AuthController],
    exports: [AuthService, DashboardAdminGuard],
})
export class AuthModule {}