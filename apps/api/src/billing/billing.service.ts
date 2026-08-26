import { Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { QuotaService } from "../metering/quota.service";
import { SubscriptionPlanTier, SubscriptionStatus } from "../generated/prisma/client";
import type { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import type { CreatePortalSessionDto } from "./dto/create-portal-session.dto";

@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);
    private readonly stripe: Stripe | null = null;
    private readonly appWebUrl: string;
    private readonly proPriceId: string | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
        private readonly quotaService: QuotaService,
    ) {
        const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
        if (secretKey) {
            this.stripe = new Stripe(secretKey, {
                apiVersion: "2025-02-24.acacia" as any,
            });
        }
        this.appWebUrl = this.configService.get<string>("APP_WEB_URL") ?? "http://localhost:3001";
        this.proPriceId = this.configService.get<string>("STRIPE_PRO_PRICE_ID") || null;
    }

    sanitizeReturnUrl(returnUrl: string | undefined, organizationId: string): string {
        const defaultUrl = `${this.appWebUrl}/dashboard/organizations/${organizationId}/billing`;
        if (!returnUrl) {
            return defaultUrl;
        }

        try {
            const parsed = new URL(returnUrl, this.appWebUrl);
            const allowedOrigin = new URL(this.appWebUrl).origin;
            if (parsed.origin !== allowedOrigin) {
                return defaultUrl;
            }
            return parsed.toString();
        } catch {
            return defaultUrl;
        }
    }

    async getOrCreateStripeCustomer(organizationId: string, userEmail?: string, orgName?: string): Promise<string> {
        const org = await this.prismaService.client.organization.findUnique({
            where: { id: organizationId },
            include: { subscription: true },
        });

        if (!org) {
            throw new NotFoundException("Organization not found");
        }

        if (org.subscription?.stripeCustomerId && !org.subscription.stripeCustomerId.startsWith("cus_local_")) {
            return org.subscription.stripeCustomerId;
        }

        if (!this.stripe) {
            // Dev/Mock fallback
            const mockCustomerId = `cus_mock_${organizationId.slice(-8)}`;
            await this.prismaService.client.subscription.upsert({
                where: { organizationId },
                create: {
                    organizationId,
                    stripeCustomerId: mockCustomerId,
                    planTier: SubscriptionPlanTier.FREE,
                    status: SubscriptionStatus.ACTIVE,
                },
                update: {
                    stripeCustomerId: mockCustomerId,
                },
            });
            return mockCustomerId;
        }

        const customer = await this.stripe.customers.create({
            email: userEmail,
            name: orgName || org.name,
            metadata: {
                organizationId: org.id,
                organizationSlug: org.slug,
            },
        });

        await this.prismaService.client.subscription.upsert({
            where: { organizationId },
            create: {
                organizationId,
                stripeCustomerId: customer.id,
                planTier: SubscriptionPlanTier.FREE,
                status: SubscriptionStatus.ACTIVE,
            },
            update: {
                stripeCustomerId: customer.id,
            },
        });

        return customer.id;
    }

    async createCheckoutSession(organizationId: string, userId: string, dto: CreateCheckoutSessionDto) {
        const user = await this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });

        const org = await this.prismaService.client.organization.findUnique({
            where: { id: organizationId },
            select: { id: true, name: true, slug: true },
        });

        if (!org) {
            throw new NotFoundException("Organization not found");
        }

        const returnUrl = this.sanitizeReturnUrl(dto.returnUrl, organizationId);
        const customerId = await this.getOrCreateStripeCustomer(organizationId, user?.email, org.name);

        if (!this.stripe) {
            // Mock checkout URL for dev/testing
            return {
                url: `${returnUrl}?session_id=mock_checkout_session_${Date.now()}&mock_plan=${dto.planTier}`,
            };
        }

        if (!this.proPriceId && dto.planTier === SubscriptionPlanTier.PRO) {
            throw new InternalServerErrorException("STRIPE_PRO_PRICE_ID is not configured");
        }

        const session = await this.stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price: this.proPriceId!,
                    quantity: 1,
                },
            ],
            success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}&checkout_success=true`,
            cancel_url: `${returnUrl}?checkout_canceled=true`,
            metadata: {
                organizationId: org.id,
                planTier: dto.planTier,
            },
        });

        return { url: session.url };
    }

    async createBillingPortalSession(organizationId: string, userId: string, dto: CreatePortalSessionDto) {
        const user = await this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });

        const customerId = await this.getOrCreateStripeCustomer(organizationId, user?.email);
        const returnUrl = this.sanitizeReturnUrl(dto.returnUrl, organizationId);

        if (!this.stripe || customerId.startsWith("cus_mock_") || customerId.startsWith("cus_local_")) {
            return {
                url: `${returnUrl}?portal_mock=true`,
            };
        }

        const session = await this.stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        return { url: session.url };
    }

    async getSubscription(organizationId: string) {
        return this.quotaService.getUsageSummary(organizationId);
    }
}
