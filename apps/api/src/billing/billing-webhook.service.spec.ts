import { ConfigService } from "@nestjs/config";
import { BillingWebhookService } from "./billing-webhook.service";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

describe("BillingWebhookService", () => {
    let service: BillingWebhookService;
    let configService: { get: jest.Mock };
    let prismaService: {
        client: {
            stripeWebhookEvent: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
            subscription: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
            user: { findFirst: jest.Mock };
        };
    };
    let emailService: { sendPaymentFailedEmail: jest.Mock };

    beforeEach(() => {
        configService = {
            get: jest.fn().mockReturnValue(undefined), // No Stripe secret in test -> safe bypass
        };
        prismaService = {
            client: {
                stripeWebhookEvent: {
                    create: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
                subscription: {
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
                user: {
                    findFirst: jest.fn(),
                },
            },
        };
        emailService = {
            sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
        };

        service = new BillingWebhookService(
            configService as unknown as ConfigService,
            prismaService as unknown as PrismaService,
            emailService as unknown as EmailService,
        );
    });

    it("returns received: true when unconfigured in local environment", async () => {
        const result = await service.processWebhook(Buffer.from("{}"), "dummy_sig");
        expect(result.received).toBe(true);
    });
});
