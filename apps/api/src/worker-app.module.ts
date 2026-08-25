import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./prisma/prisma.module";
import { BullMQConfigModule } from "./common/redis/bullmq-config.module";
import { validateEnv } from "./config/env.validation";
import { buildPinoHttpOptions } from "./config/pino-http.options";
import { AuthModule } from "./auth/auth.module";
import { QueuesModule } from "./queues/queues.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";
import { DisputesModule } from "./disputes/disputes.module";
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
        AuthModule,
        QueuesModule,
        DeliveriesModule,
        DisputesModule,
        DemoModule,
    ],
})
export class WorkerAppModule {}
