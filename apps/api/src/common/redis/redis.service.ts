import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    readonly client: Redis;

    constructor(configService: ConfigService) {
        const host = configService.get<string>("REDIS_HOST") ?? "localhost";
        const port = configService.get<number>("REDIS_PORT") ?? 6379;
        const password = configService.get<string>("REDIS_PASSWORD") || undefined;

        this.client = new Redis({
            host,
            port,
            password,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            lazyConnect: true,
        });

        this.client.on("error", (err) => {
            this.logger.warn(`Redis client error: ${err.message}`);
        });
    }

    async onModuleDestroy() {
        try {
            await this.client.quit();
        } catch {
            this.client.disconnect();
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            const result = await this.client.ping();
            return result === "PONG";
        } catch {
            return false;
        }
    }
}
