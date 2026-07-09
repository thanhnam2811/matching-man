import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { formatSlowQueryLog } from "./format-slow-query-log.util";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private readonly slowQueryThresholdMs: number;
    readonly client;

    constructor(configService: ConfigService) {
        const connectionString = configService.getOrThrow<string>("DATABASE_URL");
        const adapter = new PrismaPg({ connectionString });

        this.slowQueryThresholdMs = configService.get<number>("SLOW_QUERY_THRESHOLD_MS")!;
        this.client = new PrismaClient({
            adapter,
            log: [
                { emit: "event", level: "query" },
                { emit: "stdout", level: "warn" },
                { emit: "stdout", level: "error" },
            ],
        });

        this.client.$on("query", (event) => {
            const logPayload = formatSlowQueryLog(event, this.slowQueryThresholdMs);

            if (logPayload) {
                this.logger.warn(JSON.stringify(logPayload));
            }
        });
    }

    async onModuleInit() {
        await this.client.$connect();
        this.logger.log("Database connection established");
    }

    async onModuleDestroy() {
        await this.client.$disconnect();
    }

    async isHealthy() {
        try {
            await this.client.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }
}
