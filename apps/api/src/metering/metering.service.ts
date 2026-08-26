import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class MeteringService {
    private readonly logger = new Logger(MeteringService.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly redisService?: RedisService,
    ) {}

    private getUtcDateKey(date = new Date()): string {
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    incrementUsageAsync(
        projectId: string,
        field: "enqueueRequests" | "matchesCreated" | "webhookDeliveries",
        amount = 1,
    ): void {
        if (!projectId) return;

        const dateKey = this.getUtcDateKey();
        const redisKey = `usage:${projectId}:${dateKey}`;
        const trackingKey = `usage:active-projects:${dateKey}`;

        if (this.redisService?.client) {
            this.redisService.client
                .pipeline()
                .hincrby(redisKey, field, amount)
                .expire(redisKey, SEVEN_DAYS_SECONDS)
                .sadd(trackingKey, projectId)
                .expire(trackingKey, SEVEN_DAYS_SECONDS)
                .exec()
                .catch((err) => {
                    this.logger.warn(
                        `Failed to increment Redis usage metric ${field} for project ${projectId}: ${err.message}`,
                    );
                });
        }
    }

    recordPeakActivePools(projectId: string, count: number): void {
        if (!projectId || count <= 0) return;

        const dateKey = this.getUtcDateKey();
        const redisKey = `usage:${projectId}:${dateKey}`;
        const trackingKey = `usage:active-projects:${dateKey}`;

        if (this.redisService?.client) {
            this.redisService.client
                .hget(redisKey, "peakActivePools")
                .then((current) => {
                    const currentPeak = Number(current || 0);
                    if (count > currentPeak) {
                        return this.redisService!.client.pipeline()
                            .hset(redisKey, "peakActivePools", count)
                            .expire(redisKey, SEVEN_DAYS_SECONDS)
                            .sadd(trackingKey, projectId)
                            .expire(trackingKey, SEVEN_DAYS_SECONDS)
                            .exec();
                    }
                })
                .catch((err) => {
                    this.logger.warn(`Failed to update peakActivePools for project ${projectId}: ${err.message}`);
                });
        }
    }

    async getProjectUsageForDay(projectId: string, date = new Date()) {
        const dateKey = this.getUtcDateKey(date);
        const redisKey = `usage:${projectId}:${dateKey}`;

        if (this.redisService?.client) {
            try {
                const redisData = await this.redisService.client.hgetall(redisKey);
                if (redisData && Object.keys(redisData).length > 0) {
                    return {
                        enqueueRequests: Number(redisData.enqueueRequests || 0),
                        matchesCreated: Number(redisData.matchesCreated || 0),
                        webhookDeliveries: Number(redisData.webhookDeliveries || 0),
                        peakActivePools: Number(redisData.peakActivePools || 0),
                    };
                }
            } catch {
                // Fallback to DB
            }
        }

        const dbRecord = await this.prismaService.client.usageMetricDaily.findUnique({
            where: {
                projectId_date: {
                    projectId,
                    date: new Date(`${dateKey}T00:00:00.000Z`),
                },
            },
        });

        return {
            enqueueRequests: dbRecord?.enqueueRequests || 0,
            matchesCreated: dbRecord?.matchesCreated || 0,
            webhookDeliveries: dbRecord?.webhookDeliveries || 0,
            peakActivePools: dbRecord?.peakActivePools || 0,
        };
    }

    async getMonthlyUsageForOrganization(organizationId: string, month = new Date()) {
        const startOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        const projects = await this.prismaService.client.project.findMany({
            where: { organizationId },
            select: { id: true },
        });

        const projectIds = projects.map((p) => p.id);
        if (projectIds.length === 0) {
            return {
                enqueueRequests: 0,
                matchesCreated: 0,
                webhookDeliveries: 0,
                peakActivePools: 0,
            };
        }

        const metrics = await this.prismaService.client.usageMetricDaily.aggregate({
            where: {
                projectId: { in: projectIds },
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                },
            },
            _sum: {
                enqueueRequests: true,
                matchesCreated: true,
                webhookDeliveries: true,
            },
            _max: {
                peakActivePools: true,
            },
        });

        const sum = metrics["_sum"];
        const max = metrics["_max"];

        return {
            enqueueRequests: sum?.enqueueRequests || 0,
            matchesCreated: sum?.matchesCreated || 0,
            webhookDeliveries: sum?.webhookDeliveries || 0,
            peakActivePools: max?.peakActivePools || 0,
        };
    }
}
