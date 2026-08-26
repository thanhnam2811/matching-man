import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { SubscriptionPlanTier, SubscriptionStatus, WebhookProcessingStatus } from "../generated/prisma/client";

@Injectable()
export class BillingWebhookService {
    private readonly logger = new Logger(BillingWebhookService.name);
    private readonly stripe: Stripe | null = null;
    private readonly webhookSecret: string | null = null;

    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
        private readonly emailService: EmailService,
    ) {
        const secretKey = this.configService.get<string>("STRIPE_SECRET_KEY");
        if (secretKey) {
            this.stripe = new Stripe(secretKey, {
                apiVersion: "2025-02-24.acacia" as any,
            });
        }
        this.webhookSecret = this.configService.get<string>("STRIPE_WEBHOOK_SECRET") || null;
    }

    async processWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean }> {
        if (!this.stripe || !this.webhookSecret) {
            this.logger.warn("Stripe is not configured; skipping webhook verification.");
            return { received: true };
        }

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                this.webhookSecret,
                300, // 300 seconds clock skew tolerance
            );
        } catch (err: any) {
            this.logger.error(`Stripe signature verification failed: ${err.message}`);
            throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
        }

        // Idempotency: Atomic claim of the Stripe event
        try {
            await this.prismaService.client.stripeWebhookEvent.create({
                data: {
                    id: event.id,
                    type: event.type,
                    status: WebhookProcessingStatus.PROCESSING,
                },
            });
        } catch {
            // Already received or processed
            const existing = await this.prismaService.client.stripeWebhookEvent.findUnique({
                where: { id: event.id },
            });
            if (
                existing?.status === WebhookProcessingStatus.COMPLETED ||
                existing?.status === WebhookProcessingStatus.PROCESSING
            ) {
                this.logger.log(
                    `Stripe event ${event.id} (${event.type}) already processed or in-flight; skipping duplicate.`,
                );
                return { received: true };
            }
        }

        try {
            await this.handleStripeEvent(event);

            await this.prismaService.client.stripeWebhookEvent.update({
                where: { id: event.id },
                data: {
                    status: WebhookProcessingStatus.COMPLETED,
                    processedAt: new Date(),
                },
            });
        } catch (err: any) {
            this.logger.error(`Error processing Stripe event ${event.id} (${event.type}): ${err.message}`, err.stack);
            await this.prismaService.client.stripeWebhookEvent.update({
                where: { id: event.id },
                data: {
                    status: WebhookProcessingStatus.FAILED,
                    error: err.message,
                },
            });
            throw new InternalServerErrorException(`Failed to process Stripe event: ${err.message}`);
        }

        return { received: true };
    }

    private async handleStripeEvent(event: Stripe.Event): Promise<void> {
        const eventCreatedAt = new Date(event.created * 1000);

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                await this.handleCheckoutSessionCompleted(session, eventCreatedAt);
                break;
            }
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionUpdated(subscription, eventCreatedAt);
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await this.handleSubscriptionDeleted(subscription, eventCreatedAt);
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                await this.handleInvoicePaymentFailed(invoice, eventCreatedAt);
                break;
            }
            default:
                this.logger.log(`Unhandled Stripe event type: ${event.type}`);
        }
    }

    private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, eventCreatedAt: Date) {
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const organizationId = session.metadata?.organizationId;
        const targetPlan = (session.metadata?.planTier as SubscriptionPlanTier) || SubscriptionPlanTier.PRO;

        if (!customerId) return;

        let subscriptionRecord = await this.prismaService.client.subscription.findFirst({
            where: {
                OR: [{ stripeCustomerId: customerId }, ...(organizationId ? [{ organizationId }] : [])],
            },
        });

        if (subscriptionRecord) {
            await this.prismaService.client.subscription.update({
                where: { id: subscriptionRecord.id },
                data: {
                    stripeCustomerId: customerId,
                    stripeSubscriptionId:
                        typeof session.subscription === "string"
                            ? session.subscription
                            : session.subscription?.id || null,
                    planTier: targetPlan,
                    status: SubscriptionStatus.ACTIVE,
                    lastEventCreatedAt: eventCreatedAt,
                },
            });
            this.logger.log(
                `Activated ${targetPlan} subscription for organization ${subscriptionRecord.organizationId}`,
            );
        }
    }

    private async handleSubscriptionUpdated(subscription: Stripe.Subscription, eventCreatedAt: Date) {
        const customerId =
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) return;

        const current = await this.prismaService.client.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });

        if (!current) {
            this.logger.warn(`Received subscription.updated for unknown customerId: ${customerId}`);
            return;
        }

        // Stale event guard: discard if an event with a newer timestamp was already processed
        if (current.lastEventCreatedAt && eventCreatedAt < current.lastEventCreatedAt) {
            this.logger.warn(
                `Discarding stale subscription.updated event (created at ${eventCreatedAt.toISOString()} < ${current.lastEventCreatedAt.toISOString()})`,
            );
            return;
        }

        const status = this.mapStripeStatus(subscription.status);
        const planTier =
            (subscription.metadata?.planTier as SubscriptionPlanTier) ||
            (current.planTier === SubscriptionPlanTier.ENTERPRISE
                ? SubscriptionPlanTier.ENTERPRISE
                : subscription.status === "active"
                  ? SubscriptionPlanTier.PRO
                  : current.planTier);

        await this.prismaService.client.subscription.update({
            where: { id: current.id },
            data: {
                stripeSubscriptionId: subscription.id,
                stripePriceId: subscription.items.data[0]?.price?.id || null,
                status,
                planTier,
                currentPeriodStart: (subscription as any).current_period_start
                    ? new Date((subscription as any).current_period_start * 1000)
                    : null,
                currentPeriodEnd: (subscription as any).current_period_end
                    ? new Date((subscription as any).current_period_end * 1000)
                    : null,
                cancelAtPeriodEnd: (subscription as any).cancel_at_period_end ?? false,
                lastEventCreatedAt: eventCreatedAt,
            },
        });

        this.logger.log(
            `Updated subscription for organization ${current.organizationId}: status=${status}, planTier=${planTier}`,
        );
    }

    private async handleSubscriptionDeleted(subscription: Stripe.Subscription, eventCreatedAt: Date) {
        const customerId =
            typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
        if (!customerId) return;

        const current = await this.prismaService.client.subscription.findUnique({
            where: { stripeCustomerId: customerId },
        });

        if (!current) return;

        if (current.lastEventCreatedAt && eventCreatedAt < current.lastEventCreatedAt) {
            this.logger.warn(
                `Discarding stale subscription.deleted event (created at ${eventCreatedAt.toISOString()} < ${current.lastEventCreatedAt.toISOString()})`,
            );
            return;
        }

        await this.prismaService.client.subscription.update({
            where: { id: current.id },
            data: {
                status: SubscriptionStatus.CANCELED,
                planTier: SubscriptionPlanTier.FREE,
                cancelAtPeriodEnd: false,
                lastEventCreatedAt: eventCreatedAt,
            },
        });

        this.logger.log(`Canceled subscription for organization ${current.organizationId}. Downgraded to FREE tier.`);
    }

    private async handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventCreatedAt: Date) {
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) return;

        const current = await this.prismaService.client.subscription.findUnique({
            where: { stripeCustomerId: customerId },
            include: { organization: true },
        });

        if (!current) return;

        if (current.lastEventCreatedAt && eventCreatedAt < current.lastEventCreatedAt) {
            this.logger.warn(
                `Discarding stale invoice.payment_failed event (created at ${eventCreatedAt.toISOString()} < ${current.lastEventCreatedAt.toISOString()})`,
            );
            return;
        }

        await this.prismaService.client.subscription.update({
            where: { id: current.id },
            data: {
                status: SubscriptionStatus.PAST_DUE,
                lastEventCreatedAt: eventCreatedAt,
            },
        });

        // Dispatch grace period email alert to organization owner
        const orgOwner = await this.prismaService.client.user.findFirst({
            where: {
                organizationMemberships: {
                    some: {
                        organizationId: current.organizationId,
                        role: "OWNER",
                    },
                },
            },
        });

        if (orgOwner?.email) {
            const portalUrl = `${this.configService.get<string>("APP_WEB_URL") ?? "http://localhost:3001"}/dashboard/organizations/${current.organizationId}/billing`;
            this.emailService
                .sendPaymentFailedEmail(orgOwner.email, current.organization.name, portalUrl)
                .catch(() => {});
        }

        this.logger.warn(
            `Invoice payment failed for organization ${current.organizationId}. Marked PAST_DUE (7-day grace window active).`,
        );
    }

    private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
        switch (status) {
            case "active":
                return SubscriptionStatus.ACTIVE;
            case "past_due":
                return SubscriptionStatus.PAST_DUE;
            case "canceled":
                return SubscriptionStatus.CANCELED;
            case "trialing":
                return SubscriptionStatus.TRIALING;
            case "unpaid":
                return SubscriptionStatus.UNPAID;
            default:
                return SubscriptionStatus.ACTIVE;
        }
    }
}
