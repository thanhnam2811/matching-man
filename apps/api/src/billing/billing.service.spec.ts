import { ConfigService } from "@nestjs/config";
import { BillingService } from "./billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { QuotaService } from "../metering/quota.service";
import { SubscriptionPlanTier } from "../generated/prisma/client";

describe("BillingService", () => {
    let service: BillingService;
    let configService: { get: jest.Mock };
    let prismaService: {
        client: {
            user: { findUnique: jest.Mock };
            organization: { findUnique: jest.Mock };
            subscription: { upsert: jest.Mock; findUnique: jest.Mock };
        };
    };
    let quotaService: { getUsageSummary: jest.Mock };

    beforeEach(() => {
        configService = {
            get: jest.fn((key: string) => {
                if (key === "APP_WEB_URL") return "http://localhost:3001";
                if (key === "STRIPE_PRO_PRICE_ID") return "price_pro_123";
                return undefined;
            }),
        };
        prismaService = {
            client: {
                user: { findUnique: jest.fn() },
                organization: { findUnique: jest.fn() },
                subscription: { upsert: jest.fn(), findUnique: jest.fn() },
            },
        };
        quotaService = {
            getUsageSummary: jest.fn(),
        };

        service = new BillingService(
            configService as unknown as ConfigService,
            prismaService as unknown as PrismaService,
            quotaService as unknown as QuotaService,
        );
    });

    describe("sanitizeReturnUrl", () => {
        it("returns valid URL if on same origin as APP_WEB_URL", () => {
            const url = service.sanitizeReturnUrl("http://localhost:3001/custom/path", "org_1");
            expect(url).toBe("http://localhost:3001/custom/path");
        });

        it("neutralizes open redirect attempts to malicious external domains", () => {
            const url = service.sanitizeReturnUrl("https://evil-phishing-site.com/steal", "org_1");
            expect(url).toBe("http://localhost:3001/dashboard/organizations/org_1/billing");
        });
    });

    describe("createCheckoutSession", () => {
        it("returns mock checkout url in dev mode without live Stripe key", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_1", email: "user@example.com" });
            prismaService.client.organization.findUnique.mockResolvedValue({
                id: "org_1",
                name: "Acme Corp",
                slug: "acme",
            });
            prismaService.client.subscription.upsert.mockResolvedValue({ id: "sub_1" });

            const session = await service.createCheckoutSession("org_1", "user_1", {
                planTier: SubscriptionPlanTier.PRO,
            });

            expect(session.url).toContain("session_id=mock_checkout_session");
            expect(session.url).toContain("mock_plan=PRO");
        });
    });
});
