import { NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
    let service: ProjectsService;
    let prismaService: {
        client: {
            $transaction: jest.Mock;
            user: { upsert: jest.Mock };
            organization: { create: jest.Mock; findUnique: jest.Mock };
            project: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                $transaction: jest.fn(),
                user: { upsert: jest.fn() },
                organization: { create: jest.fn(), findUnique: jest.fn() },
                project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
            },
        };

        prismaService.client.$transaction.mockImplementation(
            async (callback: (tx: typeof prismaService.client) => unknown) => callback(prismaService.client),
        );

        service = new ProjectsService(prismaService as unknown as PrismaService);
    });

    it("creates a project under an existing organization", async () => {
        prismaService.client.user.upsert.mockResolvedValue({
            id: "user_1",
            email: "owner@example.com",
            name: "Owner",
        });
        prismaService.client.organization.findUnique.mockResolvedValue({
            id: "org_1",
            name: "Arena Studio",
            slug: "arena-studio",
        });
        prismaService.client.project.create.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: "ap-southeast-1",
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            organization: {
                id: "org_1",
                name: "Arena Studio",
                slug: "arena-studio",
            },
            environments: [{ id: "env_1", name: "production", isDefault: true }],
            members: [
                {
                    role: ProjectMemberRole.OWNER,
                    user: { id: "user_1", email: "owner@example.com", name: "Owner" },
                },
            ],
        });

        const created = await service.create({
            name: "Arena",
            slug: "arena",
            defaultRegion: "ap-southeast-1",
            organizationId: "org_1",
            owner: {
                email: "owner@example.com",
                name: "Owner",
            },
            environments: ["production"],
        });

        expect(created.organization.id).toBe("org_1");
        expect(prismaService.client.organization.create).not.toHaveBeenCalled();
    });

    it("rejects creating a project under a missing organization", async () => {
        prismaService.client.user.upsert.mockResolvedValue({
            id: "user_1",
            email: "owner@example.com",
            name: "Owner",
        });
        prismaService.client.organization.findUnique.mockResolvedValue(null);

        await expect(
            service.create({
                name: "Arena",
                slug: "arena",
                organizationId: "org_missing",
                owner: {
                    email: "owner@example.com",
                },
            }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("sanitizes webhook secrets from project detail responses", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: null,
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            updatedAt: new Date("2026-06-12T00:00:00.000Z"),
            organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
            environments: [],
            members: [],
            webhookEndpoints: [
                {
                    id: "wh_1",
                    url: "https://example.com/hook",
                    events: ["match.created"],
                    secret: "super-secret",
                    isActive: true,
                    createdAt: new Date("2026-06-12T00:00:00.000Z"),
                    updatedAt: new Date("2026-06-12T00:00:00.000Z"),
                },
            ],
        });

        const project = await service.findOne("project_1");

        expect(project.webhookEndpoints[0]).toEqual(
            expect.objectContaining({
                id: "wh_1",
                hasSecret: true,
            }),
        );
        expect(project.webhookEndpoints[0]).not.toHaveProperty("secret");
    });
});