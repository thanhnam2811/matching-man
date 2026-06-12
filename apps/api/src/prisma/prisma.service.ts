import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type PrismaClient as PrismaClientType } from "../generated/prisma/client";

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    readonly client: PrismaClientType;

    constructor(configService: ConfigService) {
        const connectionString = configService.getOrThrow<string>("DATABASE_URL");
        const adapter = new PrismaPg({ connectionString });

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