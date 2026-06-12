import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryStatus } from "../generated/prisma/client";
import type { ListDeliveriesQueryDto } from "./dto/list-deliveries-query.dto";

const RETRY_DELAYS_MS = [0, 30_000, 300_000, 1_800_000, 7_200_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;
const DELIVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookDeliveryService {
    private readonly logger = new Logger(WebhookDeliveryService.name);

    constructor(private readonly prismaService: PrismaService) {}

    async scheduleDelivery(projectId: string, eventType: string, payload: unknown) {
        const endpoints = await this.prismaService.client.webhookEndpoint.findMany({
            where: {
                projectId,
                isActive: true,
            },
        });

        const subscribedEndpoints = endpoints.filter((ep) => {
            const events = ep.events as string[];
            return events.includes(eventType);
        });

        if (subscribedEndpoints.length === 0) {
            return;
        }

        await this.prismaService.client.webhookDelivery.createMany({
            data: subscribedEndpoints.map((ep) => ({
                webhookEndpointId: ep.id,
                eventType,
                payload: payload as object,
                status: WebhookDeliveryStatus.PENDING,
                nextRetryAt: new Date(),
            })),
        });
    }

    async sendPendingDeliveries() {
        const now = new Date();
        const pending = await this.prismaService.client.webhookDelivery.findMany({
            where: {
                status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED] },
                nextRetryAt: { lte: now },
            },
            include: {
                webhookEndpoint: true,
            },
            take: 50,
        });

        await Promise.allSettled(pending.map((delivery) => this.sendDelivery(delivery)));
    }

    private async sendDelivery(delivery: {
        id: string;
        eventType: string;
        payload: unknown;
        attemptCount: number;
        webhookEndpoint: { url: string; secret: string };
    }) {
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify(delivery.payload);
        const signature = this.sign(delivery.webhookEndpoint.secret, timestamp, body);

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), DELIVERY_TIMEOUT_MS);

        let responseCode: number | null = null;
        let error: string | null = null;
        let success = false;

        try {
            const response = await fetch(delivery.webhookEndpoint.url, {
                method: "POST",
                signal: ctrl.signal,
                headers: {
                    "Content-Type": "application/json",
                    "X-Webhook-Event": delivery.eventType,
                    "X-Webhook-Timestamp": String(timestamp),
                    "X-Webhook-Signature": `sha256=${signature}`,
                },
                body,
            });

            responseCode = response.status;
            success = response.ok;

            if (!success) {
                error = `HTTP ${response.status}`;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
        } finally {
            clearTimeout(timer);
        }

        const nextAttemptCount = delivery.attemptCount + 1;
        const exhausted = nextAttemptCount >= MAX_ATTEMPTS;

        await this.prismaService.client.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
                attemptCount: nextAttemptCount,
                lastAttemptAt: new Date(),
                lastResponseCode: responseCode,
                lastError: error,
                status: success
                    ? WebhookDeliveryStatus.DELIVERED
                    : exhausted
                      ? WebhookDeliveryStatus.EXHAUSTED
                      : WebhookDeliveryStatus.FAILED,
                nextRetryAt: success || exhausted ? null : this.computeNextRetry(nextAttemptCount),
                exhaustedAt: exhausted && !success ? new Date() : undefined,
            },
        });

        if (!success) {
            this.logger.warn(`Webhook delivery ${delivery.id} attempt ${nextAttemptCount} failed: ${error}`);
        }
    }

    private sign(secret: string, timestamp: number, body: string) {
        const keyHex = secret.replace("whsec_", "");
        const key = Buffer.from(keyHex, "hex");
        return createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
    }

    private computeNextRetry(attemptCount: number) {
        const delayMs = RETRY_DELAYS_MS[attemptCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        return new Date(Date.now() + delayMs);
    }

    async listDeliveries(projectId: string, query: ListDeliveriesQueryDto) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;

        const where = {
            webhookEndpoint: { projectId },
            ...(query.status ? { status: query.status } : {}),
            ...(query.endpointId ? { webhookEndpointId: query.endpointId } : {}),
        };

        const [data, total] = await Promise.all([
            this.prismaService.client.webhookDelivery.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    webhookEndpointId: true,
                    eventType: true,
                    status: true,
                    attemptCount: true,
                    lastAttemptAt: true,
                    lastResponseCode: true,
                    lastError: true,
                    nextRetryAt: true,
                    exhaustedAt: true,
                    createdAt: true,
                },
            }),
            this.prismaService.client.webhookDelivery.count({ where }),
        ]);

        return { data, total };
    }
}