import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "../prisma/prisma.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { AuditLogService } from "./audit-logs.service";
import { AuditLogsController } from "./audit-logs.controller";
import { AuditLogInterceptor } from "./interceptors/audit-log.interceptor";

@Global()
@Module({
    imports: [PrismaModule, OrganizationsModule],
    providers: [
        AuditLogService,
        {
            provide: APP_INTERCEPTOR,
            useClass: AuditLogInterceptor,
        },
    ],
    controllers: [AuditLogsController],
    exports: [AuditLogService],
})
export class AuditLogsModule {}
