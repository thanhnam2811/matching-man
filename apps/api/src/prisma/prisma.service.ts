import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { formatSlowQueryLog } from "./format-slow-query-log.util";

const KEEPALIVE_INTERVAL_MS = 60_000;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private readonly slowQueryThresholdMs: number;
    private keepAliveTimer?: ReturnType<typeof setInterval>;
    readonly client;

    constructor(configService: ConfigService) {
        const connectionString = configService.getOrThrow<string>("DATABASE_URL");
        const adapter = new PrismaPg({
            connectionString,
            // Neon's pooler closes connections it considers idle. Keep a small
            // pool of long-lived connections instead of reconnecting (with a
            // fresh TCP+TLS handshake) on every request.
            max: 3,
            idleTimeoutMillis: 0,
            keepAlive: true,
        });

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

        this.keepAliveTimer = setInterval(() => {
            this.client.$queryRaw`SELECT 1`.catch((error: unknown) => {
                this.logger.warn(`Keepalive query failed: ${String(error)}`);
            });
        }, KEEPALIVE_INTERVAL_MS);
        this.keepAliveTimer.unref?.();
    }

    async onModuleDestroy() {
        clearInterval(this.keepAliveTimer);
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
