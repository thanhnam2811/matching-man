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
            enableOfflineQueue: false,
            connectTimeout: 2000,
            commandTimeout: 2000,
            maxRetriesPerRequest: 1,
            enableReadyCheck: false,
            lazyConnect: true,
        });

        this.client.on("error", (err) => {
            this.logger.warn(`Redis client error: ${err.message}`);
        });
    }

    async onModuleDestroy() {
        try {
            if (this.client.status === "ready") {
                await this.client.quit();
            } else {
                this.client.disconnect();
            }
        } catch {
            this.client.disconnect();
        }
    }

    async isHealthy(): Promise<boolean> {
        try {
            if (this.client.status === "wait" || this.client.status === "close") {
                await this.client.connect().catch(() => {});
            }
            const pingPromise = this.client.ping();
            const timeoutPromise = new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error("Redis ping timeout")), 1000),
            );
            const result = await Promise.race([pingPromise, timeoutPromise]);
            return result === "PONG";
        } catch {
            return false;
        }
    }
}
