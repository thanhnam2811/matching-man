import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>("REDIS_HOST") ?? "localhost",
                    port: config.get<number>("REDIS_PORT") ?? 6379,
                    password: config.get<string>("REDIS_PASSWORD") || undefined,
                    maxRetriesPerRequest: null,
                },
            }),
        }),
    ],
    providers: [RedisService],
    exports: [BullModule, RedisService],
})
export class BullMQConfigModule {}
