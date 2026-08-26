import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MeteringService } from "./metering.service";
import { QuotaService } from "./quota.service";
import { FlushDailyUsageProcessor } from "./flush-daily-usage.processor";
import { QuotaGuard } from "./guards/quota.guard";

@Global()
@Module({
    imports: [PrismaModule],
    providers: [MeteringService, QuotaService, FlushDailyUsageProcessor, QuotaGuard],
    exports: [MeteringService, QuotaService, QuotaGuard],
})
export class MeteringModule {}
