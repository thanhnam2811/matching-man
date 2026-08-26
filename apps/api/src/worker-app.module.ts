import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { BullMQConfigModule } from "./common/redis/bullmq-config.module";
import { validateEnv } from "./config/env.validation";
import { buildPinoHttpOptions } from "./config/pino-http.options";
import { EmailModule } from "./email/email.module";
import { MeteringModule } from "./metering/metering.module";
import { AuthModule } from "./auth/auth.module";
import { QueuesModule } from "./queues/queues.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";
import { DisputesModule } from "./disputes/disputes.module";
import { MatchesModule } from "./matches/matches.module";
import { PenaltiesModule } from "./penalties/penalties.module";
import { DemoModule } from "./demo/demo.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: [".env.development.local", ".env.development", ".env"],
            validate: validateEnv,
        }),
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                pinoHttp: buildPinoHttpOptions(config.get<string>("NODE_ENV")!, config.get<string>("LOG_LEVEL")!),
            }),
        }),
        ScheduleModule.forRoot(),
        BullMQConfigModule,
        PrismaModule,
        EmailModule,
        MeteringModule,
        AuthModule,
        QueuesModule,
        MatchesModule,
        DeliveriesModule,
        DisputesModule,
        PenaltiesModule,
        DemoModule,
    ],
})
export class WorkerAppModule {}
