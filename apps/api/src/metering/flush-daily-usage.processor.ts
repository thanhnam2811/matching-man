import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { createId } from "@paralleldrive/cuid2";

@Injectable()
export class FlushDailyUsageProcessor {
    private readonly logger = new Logger(FlushDailyUsageProcessor.name);

    constructor(
        private readonly prismaService: PrismaService,
        private readonly redisService?: RedisService,
    ) {}

    // Flush every 5 minutes and at midnight
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCron() {
        if (!this.redisService?.client) return;

        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        await this.flushDate(todayKey);

        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayKey = yesterday.toISOString().slice(0, 10);
        await this.flushDate(yesterdayKey);
    }

    async flushDate(dateKey: string): Promise<number> {
        if (!this.redisService?.client) return 0;

        const trackingKey = `usage:active-projects:${dateKey}`;
        let projectIds: string[] = [];

        try {
            projectIds = await this.redisService.client.smembers(trackingKey);
        } catch (err: any) {
            this.logger.warn(`Failed to read active projects for date ${dateKey}: ${err.message}`);
            return 0;
        }

        if (!projectIds || projectIds.length === 0) return 0;

        let flushedCount = 0;
        const dateObj = new Date(`${dateKey}T00:00:00.000Z`);

        for (const projectId of projectIds) {
            try {
                const redisKey = `usage:${projectId}:${dateKey}`;
                const data = await this.redisService.client.hgetall(redisKey);

                if (!data || Object.keys(data).length === 0) continue;

                const enqueueRequests = Number(data.enqueueRequests || 0);
                const matchesCreated = Number(data.matchesCreated || 0);
                const webhookDeliveries = Number(data.webhookDeliveries || 0);
                const peakActivePools = Number(data.peakActivePools || 0);

                await this.prismaService.client.usageMetricDaily.upsert({
                    where: {
                        projectId_date: {
                            projectId,
                            date: dateObj,
                        },
                    },
                    create: {
                        id: createId(),
                        projectId,
                        date: dateObj,
                        enqueueRequests,
                        matchesCreated,
                        webhookDeliveries,
                        peakActivePools,
                    },
                    update: {
                        enqueueRequests,
                        matchesCreated,
                        webhookDeliveries,
                        peakActivePools,
                    },
                });

                flushedCount++;
            } catch (err: any) {
                this.logger.warn(`Failed to flush daily usage for project ${projectId}: ${err.message}`);
            }
        }

        this.logger.log(`Flushed ${flushedCount} project usage metrics for date ${dateKey}`);
        return flushedCount;
    }
}
