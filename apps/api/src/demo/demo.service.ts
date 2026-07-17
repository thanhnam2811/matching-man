import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "../auth/password.service";
import { generateApiKey, generateSigningSecret } from "../common/utils/crypto.util";
import { normalizeSlug } from "../common/utils/slug.util";
import { buildDemoSnapshot } from "./demo.data";
import {
    DEFAULT_DEMO_EMAIL,
    DEFAULT_DEMO_NAME,
    DEFAULT_DEMO_PASSWORD,
    DEMO_API_KEY_SETTING_KEY,
    DEMO_ENVIRONMENT,
    DEMO_GAME_MODES,
    DEMO_LAST_RESET_SETTING_KEY,
    DEMO_ORG_NAME,
    DEMO_ORG_SLUG,
    DEMO_CASUAL_MODE_KEY,
    DEMO_PROJECT_NAME,
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

export type DemoPublicConfig = {
    projectId: string;
    apiKey: string;
    environment: string;
    gameModes: { skill: string; casual: string };
};

@Injectable()
export class DemoService {
    private readonly logger = new Logger(DemoService.name);
    private readonly demoEmail: string;
    private readonly demoPassword: string;
    private readonly resetIntervalMinutes: number;

    constructor(
        private readonly prisma: PrismaService,
        private readonly passwordService: PasswordService,
        config: ConfigService,
    ) {
        this.demoEmail = (config.get<string>("DEMO_ACCOUNT_EMAIL")?.trim() || DEFAULT_DEMO_EMAIL).toLowerCase();
        this.demoPassword = config.get<string>("DEMO_ACCOUNT_PASSWORD")?.trim() || DEFAULT_DEMO_PASSWORD;
        this.resetIntervalMinutes = config.get<number>("DEMO_RESET_INTERVAL_MINUTES") ?? 60;
    }

    isDemoEmail(email: string): boolean {
        return email.trim().toLowerCase() === this.demoEmail;
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

    /** Live config for the public /demo sandbox: whatever demo-arena actually is right now. */
    async getPublicConfig(): Promise<DemoPublicConfig | null> {
        const client = this.prisma.client;

        const project = await client.project.findUnique({ where: { slug: DEMO_PROJECT_SLUG } });
        if (!project) return null;

        const keySetting = await client.systemSetting.findUnique({ where: { key: DEMO_API_KEY_SETTING_KEY } });
        if (!keySetting) return null;

        const modes = await client.gameMode.findMany({ where: { projectId: project.id } });
        const skillMode = modes.find((mode) => mode.key === DEMO_SKILL_MODE_KEY);
        const casualMode = modes.find((mode) => mode.key === DEMO_CASUAL_MODE_KEY);
        if (!skillMode || !casualMode) return null;

        return {
            projectId: project.id,
            apiKey: keySetting.value,
            environment: DEMO_ENVIRONMENT,
            gameModes: { skill: skillMode.id, casual: casualMode.id },
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

    /**
     * Called by the cron each minute. Account bootstrap/migration (user, org,
     * project, game modes, recoverable API key) runs on every tick regardless
     * of the interval below — it's a handful of idempotent reads once the
     * account exists, and it must not wait for a full reset: an existing,
     * recently-reset production account upgraded to a new migration (e.g. a
     * newly-recorded system_setting) would otherwise stay unmigrated for up to
     * resetIntervalMinutes after deploy. Only the expensive data reset
     * (wipe + reseed) is gated on the interval.
     */
    async resetIfDue(): Promise<void> {
        await this.ensureAccount();

        const lastResetAt = await this.getLastResetAt();
        if (lastResetAt) {
            const elapsedMs = Date.now() - lastResetAt.getTime();
            if (elapsedMs < this.resetIntervalMinutes * 60_000) return;
        }

        await this.reset();
    }

    /**
     * Restores the shared demo account to a clean, fully-populated state:
     * bootstraps the account if it doesn't exist yet, deletes any visitor-created
     * clutter (extra orgs/projects), then wipes and reseeds the canonical demo
     * project. The project row and its API keys are preserved across resets so
     * their ids stay stable.
     */
    async reset(): Promise<{ ok: boolean; reason?: string }> {
        const account = await this.ensureAccount();
        const webhookEndpoint = await this.ensureWebhookEndpoint(account.project.id);
        const skillPool = await this.ensurePool(account.project.id, account.skillModeId);
        const casualPool = await this.ensurePool(account.project.id, account.casualModeId);

        const now = new Date();
        const snapshot = buildDemoSnapshot({
            now,
            skillGameModeId: account.skillModeId,
            casualGameModeId: account.casualModeId,
            skillPoolId: skillPool.id,
            casualPoolId: casualPool.id,
            webhookEndpointId: webhookEndpoint.id,
        });

        await this.prisma.client.$transaction(async (tx) => {
            await this.purgeJunk(tx, account.userId, account.organizationId, account.project.id);
            await this.wipeActivity(tx, account.project.id);

            await tx.team.createMany({
                data: snapshot.teams.map((team) => ({
                    id: team.id,
                    projectId: account.project.id,
                    externalTeamId: team.externalTeamId,
                })),
            });
            await tx.teamMember.createMany({ data: snapshot.teamMembers });
            await tx.queueEntry.createMany({
                data: snapshot.queueEntries.map((entry) => ({ ...entry, projectId: account.project.id })),
            });
            await tx.match.createMany({
                data: snapshot.matches.map((match) => ({ ...match, projectId: account.project.id })),
            });
            await tx.matchSlot.createMany({ data: snapshot.matchSlots });
            await tx.matchResult.createMany({ data: snapshot.matchResults });
            await tx.ratingProfile.createMany({
                data: snapshot.ratingProfiles.map((profile) => ({ ...profile, projectId: account.project.id })),
            });
            await tx.ratingHistory.createMany({ data: snapshot.ratingHistory });
            await tx.webhookDelivery.createMany({
                data: snapshot.webhookDeliveries.map((del) => ({ ...del, webhookEndpointId: webhookEndpoint.id })),
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

    // Find-or-create the demo user, org, project, game modes and an API key.
    private async ensureAccount() {
        const client = this.prisma.client;

        let user = await client.user.findUnique({ where: { email: this.demoEmail } });
        if (!user) {
            const passwordHash = await this.passwordService.hash(this.demoPassword);
            user = await client.user.create({
                data: { email: this.demoEmail, name: DEFAULT_DEMO_NAME, passwordHash },
            });
            this.logger.log(`Bootstrapped demo user ${this.demoEmail}`);
        }

        let project = await client.project.findUnique({ where: { slug: DEMO_PROJECT_SLUG } });
        let organizationId: string;
        if (project) {
            organizationId = project.organizationId;
        } else {
            organizationId = await this.ensureOrganization(user.id);
            project = await client.project.create({
                data: { name: DEMO_PROJECT_NAME, slug: DEMO_PROJECT_SLUG, organizationId },
            });
            this.logger.log(`Bootstrapped demo project ${DEMO_PROJECT_SLUG}`);
        }

        for (const spec of DEMO_GAME_MODES) {
            const existing = await client.gameMode.findUnique({
                where: { projectId_key: { projectId: project.id, key: spec.key } },
            });
            if (!existing) {
                await client.gameMode.create({
                    data: {
                        projectId: project.id,
                        key: spec.key,
                        name: spec.name,
                        matchStructure: spec.matchStructure,
                        requiredSlots: spec.requiredSlots,
                        groupCount: spec.groupCount,
                        teamSizeMin: spec.teamSizeMin,
                        teamSizeMax: spec.teamSizeMax,
                        ratingMode: spec.ratingMode,
                        initialRatingWindow: spec.initialRatingWindow,
                        windowExpandIntervalSeconds: spec.windowExpandIntervalSeconds,
                        windowExpandStep: spec.windowExpandStep,
                    },
                });
            }
        }

        const modes = await client.gameMode.findMany({ where: { projectId: project.id } });
        const skillMode = modes.find((mode) => mode.key === DEMO_SKILL_MODE_KEY)!;
        const casualMode = modes.find((mode) => mode.key === DEMO_CASUAL_MODE_KEY)!;

        const anyKey = await client.apiKey.findFirst({ where: { projectId: project.id } });
        const keySetting = await client.systemSetting.findUnique({ where: { key: DEMO_API_KEY_SETTING_KEY } });
        if (!keySetting) {
            // No recoverable raw key on file. If an old key row exists (e.g. a
            // deployment that predates this feature), it's a one-way hash we can't
            // read back, so rotate it — the demo key protects nothing but a
            // sandboxed project that resets hourly, so rotation is free.
            if (anyKey) await client.apiKey.delete({ where: { id: anyKey.id } });
            const generated = generateApiKey();
            await client.apiKey.create({
                data: {
                    projectId: project.id,
                    name: "demo-key",
                    keyPrefix: generated.prefix,
                    lastFour: generated.lastFour,
                    hashedKey: generated.hashed,
                },
            });
            await client.systemSetting.create({
                data: { key: DEMO_API_KEY_SETTING_KEY, value: generated.raw },
            });
        }

        return { userId: user.id, organizationId, project, skillModeId: skillMode.id, casualModeId: casualMode.id };
    }

    private async ensureOrganization(userId: string): Promise<string> {
        const client = this.prisma.client;

        const existing = await client.organization.findFirst({
            where: { createdById: userId, name: DEMO_ORG_NAME },
        });
        if (existing) return existing.id;

        let slug = normalizeSlug(DEMO_ORG_SLUG);
        if (await client.organization.findUnique({ where: { slug } })) {
            slug = `${slug}-${randomBytes(3).toString("hex")}`;
        }

        const organization = await client.organization.create({
            data: { name: DEMO_ORG_NAME, slug, createdById: userId },
        });
        await client.organizationMember.create({
            data: { organizationId: organization.id, userId, role: ProjectMemberRole.OWNER },
        });
        return organization.id;
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

    // Deletes visitor-created clutter: every project the demo user owns except the
    // canonical demo project (extra projects in the demo org + every project in any
    // other org the demo user created), then those empty extra orgs.
    private async purgeJunk(
        tx: Prisma.TransactionClient,
        userId: string,
        demoOrgId: string,
        demoProjectId: string,
    ): Promise<void> {
        const extraOrgs = await tx.organization.findMany({
            where: { createdById: userId, id: { not: demoOrgId } },
            select: { id: true },
        });
        const extraOrgIds = extraOrgs.map((org) => org.id);

        const junkProjects = await tx.project.findMany({
            where: {
                OR: [
                    { organizationId: demoOrgId, id: { not: demoProjectId } },
                    ...(extraOrgIds.length > 0 ? [{ organizationId: { in: extraOrgIds } }] : []),
                ],
            },
            select: { id: true },
        });

        await this.deleteProjectsDeep(
            tx,
            junkProjects.map((project) => project.id),
        );

        if (extraOrgIds.length > 0) {
            await tx.organizationMember.deleteMany({ where: { organizationId: { in: extraOrgIds } } });
            await tx.organization.deleteMany({ where: { id: { in: extraOrgIds } } });
        }
    }

    // Fully removes the given projects, children before parents (no cascade FKs).
    private async deleteProjectsDeep(tx: Prisma.TransactionClient, projectIds: string[]): Promise<void> {
        if (projectIds.length === 0) return;
        const inProjects = { in: projectIds };

        await tx.ratingHistory.deleteMany({ where: { ratingProfile: { projectId: inProjects } } });
        await tx.matchResult.deleteMany({ where: { match: { projectId: inProjects } } });
        await tx.matchSlot.deleteMany({ where: { match: { projectId: inProjects } } });
        await tx.match.deleteMany({ where: { projectId: inProjects } });
        await tx.queueEntry.deleteMany({ where: { projectId: inProjects } });
        await tx.teamMember.deleteMany({ where: { team: { projectId: inProjects } } });
        await tx.team.deleteMany({ where: { projectId: inProjects } });
        await tx.matchPool.deleteMany({ where: { projectId: inProjects } });
        await tx.ratingProfile.deleteMany({ where: { projectId: inProjects } });
        await tx.webhookDelivery.deleteMany({ where: { webhookEndpoint: { projectId: inProjects } } });
        await tx.webhookEndpoint.deleteMany({ where: { projectId: inProjects } });
        await tx.apiKey.deleteMany({ where: { projectId: inProjects } });
        await tx.projectEnvironment.deleteMany({ where: { projectId: inProjects } });
        await tx.projectMember.deleteMany({ where: { projectId: inProjects } });
        await tx.project.deleteMany({ where: { id: inProjects } });
    }

    // Wipes the demo project's transactional data, children before parents. Pools,
    // game modes, API keys and the webhook endpoint are intentionally preserved.
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
