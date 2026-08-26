import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../common/redis/redis.service";
import { MeteringService } from "./metering.service";
import { SubscriptionPlanTier } from "../generated/prisma/client";

export interface PlanLimits {
    maxMonthlyMatches: number;
    maxMonthlyEnqueues: number;
    maxActivePools: number;
    maxWebhooks: number;
    maxMembers: number;
    auditLogRetentionDays: number;
}

export const PLAN_LIMITS: Record<SubscriptionPlanTier, PlanLimits> = {
    FREE: {
        maxMonthlyMatches: 5_000,
        maxMonthlyEnqueues: 25_000,
        maxActivePools: 5,
        maxWebhooks: 2,
        maxMembers: 3,
        auditLogRetentionDays: 7,
    },
    PRO: {
        maxMonthlyMatches: 100_000,
        maxMonthlyEnqueues: 500_000,
        maxActivePools: 30,
        maxWebhooks: 10,
        maxMembers: 10,
        auditLogRetentionDays: 90,
    },
    ENTERPRISE: {
        maxMonthlyMatches: Number.POSITIVE_INFINITY,
        maxMonthlyEnqueues: Number.POSITIVE_INFINITY,
        maxActivePools: Number.POSITIVE_INFINITY,
        maxWebhooks: Number.POSITIVE_INFINITY,
        maxMembers: Number.POSITIVE_INFINITY,
        auditLogRetentionDays: 365,
    },
};

@Injectable()
export class QuotaService {
    private readonly logger = new Logger(QuotaService.name);
    // L1 In-memory cache (30s TTL)
    private readonly memoryCache = new Map<
        string,
        { planTier: SubscriptionPlanTier; isOverQuota: boolean; expiresAt: number }
    >();

    constructor(
        private readonly prismaService: PrismaService,
        private readonly meteringService: MeteringService,
        private readonly redisService?: RedisService,
    ) {}

    async getOrganizationPlanTier(organizationId: string): Promise<SubscriptionPlanTier> {
        const sub = await this.prismaService.client.subscription.findUnique({
            where: { organizationId },
            select: { planTier: true, status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
        });

        if (!sub) return SubscriptionPlanTier.FREE;
        if (sub.status === "ACTIVE" || sub.status === "TRIALING") {
            if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
                return SubscriptionPlanTier.FREE;
            }
            return sub.planTier;
        }
        if (sub.status === "PAST_DUE") {
            // Soft grace window allows plan tier to persist
            return sub.planTier;
        }
        return SubscriptionPlanTier.FREE;
    }

    async checkEnqueueQuota(
        projectId: string,
    ): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
        const now = Date.now();
        const cached = this.memoryCache.get(projectId);
        if (cached && cached.expiresAt > now) {
            if (cached.isOverQuota) {
                return {
                    allowed: false,
                    reason: `Monthly enqueue quota exceeded for ${cached.planTier} tier. Please upgrade to Pro for higher limits.`,
                };
            }
            return { allowed: true };
        }

        try {
            const project = await this.prismaService.client.project.findUnique({
                where: { id: projectId },
                select: { organizationId: true },
            });

            if (!project) return { allowed: true };

            const planTier = await this.getOrganizationPlanTier(project.organizationId);
            const limits = PLAN_LIMITS[planTier];

            if (limits.maxMonthlyEnqueues === Number.POSITIVE_INFINITY) {
                this.memoryCache.set(projectId, { planTier, isOverQuota: false, expiresAt: now + 30_000 });
                return { allowed: true };
            }

            const usage = await this.meteringService.getMonthlyUsageForOrganization(project.organizationId);

            if (usage.enqueueRequests >= limits.maxMonthlyEnqueues) {
                this.memoryCache.set(projectId, { planTier, isOverQuota: true, expiresAt: now + 30_000 });
                return {
                    allowed: false,
                    reason: `Monthly enqueue quota exceeded (${usage.enqueueRequests} / ${limits.maxMonthlyEnqueues}) for ${planTier} tier. Please upgrade your subscription.`,
                    current: usage.enqueueRequests,
                    limit: limits.maxMonthlyEnqueues,
                };
            }

            this.memoryCache.set(projectId, { planTier, isOverQuota: false, expiresAt: now + 30_000 });
            return { allowed: true };
        } catch (err: any) {
            // Fail-open policy: Never block core matchmaking if quota inspection encounters transient DB error
            this.logger.warn(`Quota check failed for project ${projectId} (failing open): ${err.message}`);
            return { allowed: true };
        }
    }

    async getUsageSummary(organizationId: string) {
        const planTier = await this.getOrganizationPlanTier(organizationId);
        const limits = PLAN_LIMITS[planTier];
        const usage = await this.meteringService.getMonthlyUsageForOrganization(organizationId);

        const sub = await this.prismaService.client.subscription.findUnique({
            where: { organizationId },
        });

        return {
            planTier,
            limits: {
                maxMonthlyMatches:
                    limits.maxMonthlyMatches === Number.POSITIVE_INFINITY ? -1 : limits.maxMonthlyMatches,
                maxMonthlyEnqueues:
                    limits.maxMonthlyEnqueues === Number.POSITIVE_INFINITY ? -1 : limits.maxMonthlyEnqueues,
                maxActivePools: limits.maxActivePools === Number.POSITIVE_INFINITY ? -1 : limits.maxActivePools,
                maxWebhooks: limits.maxWebhooks === Number.POSITIVE_INFINITY ? -1 : limits.maxWebhooks,
                maxMembers: limits.maxMembers === Number.POSITIVE_INFINITY ? -1 : limits.maxMembers,
                auditLogRetentionDays: limits.auditLogRetentionDays,
            },
            usage: {
                matchesCreated: usage.matchesCreated,
                enqueueRequests: usage.enqueueRequests,
                webhookDeliveries: usage.webhookDeliveries,
                peakActivePools: usage.peakActivePools,
            },
            subscription: sub
                ? {
                      status: sub.status,
                      planTier: sub.planTier,
                      currentPeriodStart: sub.currentPeriodStart,
                      currentPeriodEnd: sub.currentPeriodEnd,
                      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                  }
                : null,
        };
    }
}
