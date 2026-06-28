import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
    constructor(private readonly prismaService: PrismaService) {}

    async getHealth() {
        const database = await this.prismaService.isHealthy();

        return {
            status: database ? "ok" : "degraded",
            checks: {
                database: database ? "up" : "down",
            },
            timestamp: new Date().toISOString(),
        };
    }
}
