import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { generateSigningSecret } from "../common/utils/crypto.util";
import { buildDemoSnapshot } from "./demo.data";
import {
    DEMO_CASUAL_MODE_KEY,
    DEMO_ENVIRONMENT,
    DEMO_LAST_RESET_SETTING_KEY,
    DEMO_PROJECT_SLUG,
    DEMO_REGION_KEY,
    DEMO_SKILL_MODE_KEY,
    DEMO_WEBHOOK_URL,
} from "./demo.constants";

export type DemoStatus = {
    isDemoAccount: boolean;
    resetIntervalMinutes: number;
    lastResetAt: string | null;
    nextResetAt: string | null;
};

@Injectable()
export class DemoService {
    private readonly logger = new Logger(DemoService.name);
    private readonly demoEmail: string | null;
    private readonly resetIntervalMinutes: number;

    constructor(
        private readonly prisma: PrismaService,
        config: ConfigService,
    ) {
        const email = config.get<string>("DEMO_ACCOUNT_EMAIL")?.trim().toLowerCase();
        this.demoEmail = email && email.length > 0 ? email : null;
        this.resetIntervalMinutes = config.get<number>("DEMO_RESET_INTERVAL_MINUTES") ?? 60;
    }

    isEnabled(): boolean {
        return this.demoEmail !== null;
    }

    isDemoEmail(email: string): boolean {
        return this.demoEmail !== null && email.trim().toLowerCase() === this.demoEmail;
    }

    /** Demo banner payload for the dashboard, folded into /auth/me. */
    async getStatusForEmail(email: string): Promise<DemoStatus> {
        // Only the demo account gets the banner, so skip the settings read for
        // everyone else — this runs on every /auth/me call.
        if (!this.isDemoEmail(email)) {
            return {
                isDemoAccount: false,
                resetIntervalMinutes: this.resetIntervalMinutes,
                lastResetAt: null,
                nextResetAt: null,
            };
        }

        const lastResetAt = await this.getLastResetAt();
        const nextResetAt = lastResetAt ? new Date(lastResetAt.getTime() + this.resetIntervalMinutes * 60_000) : null;

        return {
            isDemoAccount: true,
            resetIntervalMinutes: this.resetIntervalMinutes,
            lastResetAt: lastResetAt?.toISOString() ?? null,
            nextResetAt: nextResetAt?.toISOString() ?? null,
        };
    }

    private async getLastResetAt(): Promise<Date | null> {
        const setting = await this.prisma.client.systemSetting.findUnique({
            where: { key: DEMO_LAST_RESET_SETTING_KEY },
        });
        if (!setting) return null;
        const parsed = new Date(setting.value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    /** Called by the cron each minute; resets only when the interval has elapsed. */
    async resetIfDue(): Promise<void> {
        if (!this.isEnabled()) return;

        const lastResetAt = await this.getLastResetAt();
        if (lastResetAt) {
            const elapsedMs = Date.now() - lastResetAt.getTime();
            if (elapsedMs < this.resetIntervalMinutes * 60_000) return;
        }

        await this.reset();
    }

    /**
     * Restores the demo project's showcase data to a pristine, fully-populated
     * snapshot. Durable objects (user, org, project, game modes, API keys) are
     * left untouched so the public /demo page's API key keeps working — only the
     * transactional activity inside the project is wiped and reseeded.
     */
    async reset(): Promise<{ ok: boolean; reason?: string }> {
        if (!this.isEnabled()) {
            return { ok: false, reason: "DEMO_ACCOUNT_EMAIL is not set" };
        }

        const user = await this.prisma.client.user.findUnique({ where: { email: this.demoEmail! } });
        if (!user) {
            this.logger.warn(`Demo reset skipped: no user for ${this.demoEmail} (run seed-demo first)`);
            return { ok: false, reason: "demo user not found" };
        }

        const project = await this.prisma.client.project.findUnique({ where: { slug: DEMO_PROJECT_SLUG } });
        if (!project) {
            this.logger.warn(`Demo reset skipped: project "${DEMO_PROJECT_SLUG}" not found (run seed-demo first)`);
            return { ok: false, reason: "demo project not found" };
        }

        const modes = await this.prisma.client.gameMode.findMany({
            where: { projectId: project.id, key: { in: [DEMO_SKILL_MODE_KEY, DEMO_CASUAL_MODE_KEY] } },
        });
        const skillMode = modes.find((mode) => mode.key === DEMO_SKILL_MODE_KEY);
        const casualMode = modes.find((mode) => mode.key === DEMO_CASUAL_MODE_KEY);
        if (!skillMode || !casualMode) {
            this.logger.warn(`Demo reset skipped: missing game modes on "${DEMO_PROJECT_SLUG}"`);
            return { ok: false, reason: "demo game modes not found" };
        }

        const webhookEndpoint = await this.ensureWebhookEndpoint(project.id);
        const skillPool = await this.ensurePool(project.id, skillMode.id);
        const casualPool = await this.ensurePool(project.id, casualMode.id);

        const now = new Date();
        const snapshot = buildDemoSnapshot({
            now,
            skillGameModeId: skillMode.id,
            casualGameModeId: casualMode.id,
            skillPoolId: skillPool.id,
            casualPoolId: casualPool.id,
            webhookEndpointId: webhookEndpoint.id,
        });

        await this.prisma.client.$transaction(async (tx) => {
            await this.wipeActivity(tx, project.id);

            await tx.team.createMany({
                data: snapshot.teams.map((team) => ({
                    id: team.id,
                    projectId: project.id,
                    externalTeamId: team.externalTeamId,
                })),
            });
            await tx.teamMember.createMany({ data: snapshot.teamMembers });
            await tx.queueEntry.createMany({
                data: snapshot.queueEntries.map((entry) => ({ ...entry, projectId: project.id })),
            });
            await tx.match.createMany({
                data: snapshot.matches.map((match) => ({ ...match, projectId: project.id })),
            });
            await tx.matchSlot.createMany({ data: snapshot.matchSlots });
            await tx.matchResult.createMany({ data: snapshot.matchResults });
            await tx.ratingProfile.createMany({
                data: snapshot.ratingProfiles.map((profile) => ({ ...profile, projectId: project.id })),
            });
            await tx.ratingHistory.createMany({ data: snapshot.ratingHistory });
            await tx.webhookDelivery.createMany({
                data: snapshot.webhookDeliveries.map((del) => ({
                    ...del,
                    webhookEndpointId: webhookEndpoint.id,
                })),
            });

            await tx.systemSetting.upsert({
                where: { key: DEMO_LAST_RESET_SETTING_KEY },
                create: { key: DEMO_LAST_RESET_SETTING_KEY, value: now.toISOString() },
                update: { value: now.toISOString() },
            });
        });

        this.logger.log(
            `Demo data reset: ${snapshot.matches.length} matches, ${snapshot.queueEntries.length} queue entries, ` +
                `${snapshot.ratingProfiles.length} rating profiles, ${snapshot.webhookDeliveries.length} deliveries`,
        );
        return { ok: true };
    }

    private async ensureWebhookEndpoint(projectId: string) {
        const existing = await this.prisma.client.webhookEndpoint.findFirst({ where: { projectId } });
        if (existing) return existing;

        return this.prisma.client.webhookEndpoint.create({
            data: {
                projectId,
                url: DEMO_WEBHOOK_URL,
                secret: generateSigningSecret(),
                events: ["match.created", "match.completed", "queue.timeout"],
                isActive: true,
            },
        });
    }

    private async ensurePool(projectId: string, gameModeId: string) {
        return this.prisma.client.matchPool.upsert({
            where: {
                projectId_gameModeId_environment_regionKey: {
                    projectId,
                    gameModeId,
                    environment: DEMO_ENVIRONMENT,
                    regionKey: DEMO_REGION_KEY,
                },
            },
            create: { projectId, gameModeId, environment: DEMO_ENVIRONMENT, regionKey: DEMO_REGION_KEY },
            update: {},
        });
    }

    // Deletes the project's transactional data, children before parents (no
    // cascade FKs exist). Pools, game modes, API keys and the webhook endpoint
    // are intentionally preserved.
    private async wipeActivity(tx: Prisma.TransactionClient, projectId: string): Promise<void> {
        await tx.ratingHistory.deleteMany({ where: { ratingProfile: { projectId } } });
        await tx.matchResult.deleteMany({ where: { match: { projectId } } });
        await tx.matchSlot.deleteMany({ where: { match: { projectId } } });
        await tx.match.deleteMany({ where: { projectId } });
        await tx.queueEntry.deleteMany({ where: { projectId } });
        await tx.teamMember.deleteMany({ where: { team: { projectId } } });
        await tx.team.deleteMany({ where: { projectId } });
        await tx.ratingProfile.deleteMany({ where: { projectId } });
        await tx.webhookDelivery.deleteMany({ where: { webhookEndpoint: { projectId } } });
    }
}
