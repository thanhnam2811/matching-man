import { INestApplication } from "@nestjs/common";
import { buildTestApp } from "./support/build-app";
import { PrismaService } from "../src/prisma/prisma.service";
import { PasswordService } from "../src/auth/password.service";
import { DemoService } from "../src/demo/demo.service";

describe("DemoService.reset (real DB)", () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let demo: DemoService;
    let password: PasswordService;

    beforeAll(async () => {
        app = await buildTestApp();
        prisma = app.get(PrismaService);
        demo = app.get(DemoService);
        password = app.get(PasswordService);
    });

    afterAll(async () => {
        await app.close();
    });

    it("bootstraps the account from scratch on first reset", async () => {
        const result = await demo.reset();
        expect(result.ok).toBe(true);

        const user = await prisma.client.user.findUnique({ where: { email: "demo@matchinghub.dev" } });
        expect(user).not.toBeNull();
        // Default password must actually authenticate.
        expect(await password.verify("demo-password-123", user!.passwordHash!)).toBe(true);

        const project = await prisma.client.project.findUnique({ where: { slug: "demo-arena" } });
        expect(project).not.toBeNull();

        const [matches, queued, profiles, deliveries, modes, keys] = await Promise.all([
            prisma.client.match.count({ where: { projectId: project!.id } }),
            prisma.client.queueEntry.count({ where: { projectId: project!.id } }),
            prisma.client.ratingProfile.count({ where: { projectId: project!.id } }),
            prisma.client.webhookDelivery.count({ where: { webhookEndpoint: { projectId: project!.id } } }),
            prisma.client.gameMode.count({ where: { projectId: project!.id } }),
            prisma.client.apiKey.count({ where: { projectId: project!.id } }),
        ]);
        expect(matches).toBeGreaterThan(0);
        expect(queued).toBeGreaterThan(0);
        expect(profiles).toBeGreaterThan(0);
        expect(deliveries).toBeGreaterThan(0);
        expect(modes).toBe(2);
        expect(keys).toBe(1);
    });

    it("is idempotent and keeps the project id + api key stable across resets", async () => {
        const before = await prisma.client.project.findUnique({ where: { slug: "demo-arena" } });
        const keyBefore = await prisma.client.apiKey.findFirstOrThrow({ where: { projectId: before!.id } });
        const matchesBefore = await prisma.client.match.count({ where: { projectId: before!.id } });

        await demo.reset();

        const after = await prisma.client.project.findUnique({ where: { slug: "demo-arena" } });
        const keyAfter = await prisma.client.apiKey.findFirstOrThrow({ where: { projectId: after!.id } });
        const matchesAfter = await prisma.client.match.count({ where: { projectId: after!.id } });

        expect(after!.id).toBe(before!.id);
        expect(keyAfter.id).toBe(keyBefore.id); // api key preserved -> /demo env stays valid
        expect(matchesAfter).toBe(matchesBefore); // deterministic snapshot size
    });

    it("records a recoverable raw API key and reuses it across resets", async () => {
        const project = await prisma.client.project.findUniqueOrThrow({ where: { slug: "demo-arena" } });
        const setting = await prisma.client.systemSetting.findUnique({ where: { key: "demo:api_key" } });
        expect(setting).not.toBeNull();
        expect(setting!.value).toMatch(/^mhub_[0-9a-f]{48}$/);

        const config = await demo.getPublicConfig();
        expect(config).not.toBeNull();
        expect(config!.projectId).toBe(project.id);
        expect(config!.apiKey).toBe(setting!.value);

        await demo.reset();
        const settingAfter = await prisma.client.systemSetting.findUnique({ where: { key: "demo:api_key" } });
        expect(settingAfter!.value).toBe(setting!.value); // stable across resets
    });

    it("rotates an old key that has no recorded raw value (pre-migration deployments)", async () => {
        const project = await prisma.client.project.findUniqueOrThrow({ where: { slug: "demo-arena" } });
        const oldKey = await prisma.client.apiKey.findFirstOrThrow({ where: { projectId: project.id } });

        // Simulate a deployment that predates this feature: key row exists, no setting.
        await prisma.client.systemSetting.delete({ where: { key: "demo:api_key" } });

        await demo.reset();

        const newKey = await prisma.client.apiKey.findFirstOrThrow({ where: { projectId: project.id } });
        expect(newKey.id).not.toBe(oldKey.id); // rotated, not reused (raw value was unrecoverable)
        const setting = await prisma.client.systemSetting.findUniqueOrThrow({ where: { key: "demo:api_key" } });
        expect(setting.value).toMatch(/^mhub_[0-9a-f]{48}$/);
    });

    it("purges visitor-created junk projects and extra orgs", async () => {
        const user = await prisma.client.user.findUniqueOrThrow({ where: { email: "demo@matchinghub.dev" } });
        const demoProject = await prisma.client.project.findUniqueOrThrow({ where: { slug: "demo-arena" } });
        const demoOrgId = demoProject.organizationId;

        // Junk #1: an extra project inside the demo org, with a child row.
        const junkProject = await prisma.client.project.create({
            data: { name: "Junk", slug: `junk-${Date.now()}`, organizationId: demoOrgId },
        });
        await prisma.client.apiKey.create({
            data: {
                projectId: junkProject.id,
                name: "junk-key",
                keyPrefix: "mhub_junk",
                lastFour: "0000",
                hashedKey: "x",
            },
        });

        // Junk #2: a whole extra org the demo user created, with its own project.
        const junkOrg = await prisma.client.organization.create({
            data: { name: "Junk Org", slug: `junk-org-${Date.now()}`, createdById: user.id },
        });
        await prisma.client.organizationMember.create({
            data: { organizationId: junkOrg.id, userId: user.id, role: "OWNER" },
        });
        await prisma.client.project.create({
            data: { name: "Junk 2", slug: `junk2-${Date.now()}`, organizationId: junkOrg.id },
        });

        await demo.reset();

        // All junk gone; demo project + org survive.
        expect(await prisma.client.project.findUnique({ where: { id: junkProject.id } })).toBeNull();
        expect(await prisma.client.organization.findUnique({ where: { id: junkOrg.id } })).toBeNull();
        expect(await prisma.client.project.count({ where: { organizationId: demoOrgId } })).toBe(1);
        expect(await prisma.client.project.findUnique({ where: { slug: "demo-arena" } })).not.toBeNull();
    });
});
