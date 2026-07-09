import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulerHealthModule } from "../common/scheduler-health/scheduler-health.module";
import { PasswordService } from "../auth/password.service";
import { DemoService } from "./demo.service";
import { DemoResetProcessor } from "./demo-reset.processor";

@Module({
    imports: [PrismaModule, SchedulerHealthModule],
    providers: [DemoService, DemoResetProcessor, PasswordService],
    exports: [DemoService],
})
export class DemoModule {}
