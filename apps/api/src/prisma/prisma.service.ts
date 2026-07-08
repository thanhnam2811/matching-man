import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    readonly client;

    constructor(configService: ConfigService) {
        const connectionString = configService.getOrThrow<string>("DATABASE_URL");
        // The VPS is ~260ms round-trip from Neon (us-east-1), so a TLS+SCRAM
        // handshake costs ~750ms-2s. The pg default idleTimeoutMillis (10s) is
        // shorter than the gaps between health checks/cron ticks, forcing a
        // fresh handshake on almost every query. Keep idle connections around
        // long enough to actually get reused.
        const adapter = new PrismaPg({
            connectionString,
            idleTimeoutMillis: 60_000,
            connectionTimeoutMillis: 10_000,
        });

        this.client = new PrismaClient({
            adapter,
            log:
                configService.get<string>("NODE_ENV") === "development"
                    ? ["query", "warn", "error"]
                    : ["warn", "error"],
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
