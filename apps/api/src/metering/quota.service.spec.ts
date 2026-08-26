import { QuotaService } from "./quota.service";
import { MeteringService } from "./metering.service";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionPlanTier, SubscriptionStatus } from "../generated/prisma/client";

describe("QuotaService", () => {
    let service: QuotaService;
    let prismaService: {
        client: {
            subscription: { findUnique: jest.Mock };
            project: { findUnique: jest.Mock };
        };
    };
    let meteringService: {
        getMonthlyUsageForOrganization: jest.Mock;
    };

    beforeEach(() => {
        prismaService = {
            client: {
                subscription: { findUnique: jest.fn() },
                project: { findUnique: jest.fn() },
            },
        };
        meteringService = {
            getMonthlyUsageForOrganization: jest.fn(),
        };

        service = new QuotaService(
            prismaService as unknown as PrismaService,
            meteringService as unknown as MeteringService,
        );
    });

    describe("checkEnqueueQuota", () => {
        it("allows enqueues within FREE quota limit", async () => {
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.subscription.findUnique.mockResolvedValue({
                planTier: SubscriptionPlanTier.FREE,
                status: SubscriptionStatus.ACTIVE,
            });
            meteringService.getMonthlyUsageForOrganization.mockResolvedValue({
                enqueueRequests: 1000,
                matchesCreated: 100,
                webhookDeliveries: 50,
                peakActivePools: 2,
            });

            const result = await service.checkEnqueueQuota("proj_1");
            expect(result.allowed).toBe(true);
        });

        it("blocks enqueues exceeding FREE quota limit (25,000 enqueues)", async () => {
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.subscription.findUnique.mockResolvedValue({
                planTier: SubscriptionPlanTier.FREE,
                status: SubscriptionStatus.ACTIVE,
            });
            meteringService.getMonthlyUsageForOrganization.mockResolvedValue({
                enqueueRequests: 25001,
                matchesCreated: 4000,
                webhookDeliveries: 500,
                peakActivePools: 5,
            });

            const result = await service.checkEnqueueQuota("proj_1");
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain("Monthly enqueue quota exceeded");
        });

        it("fails open if database throws an exception", async () => {
            prismaService.client.project.findUnique.mockRejectedValue(new Error("DB Connection Error"));

            const result = await service.checkEnqueueQuota("proj_1");
            expect(result.allowed).toBe(true);
        });
    });
});
