import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
    let service: ProjectsService;
    let prismaService: {
        client: {
            project: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
            organizationMember: { findUnique: jest.Mock };
        };
    };
    let organizationsService: { assertAccess: jest.Mock };

    const userContext = { authUserId: "user_1", isSuperAdmin: false };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
                organizationMember: { findUnique: jest.fn() },
            },
        };
        organizationsService = { assertAccess: jest.fn().mockResolvedValue(undefined) };

        service = new ProjectsService(
            prismaService as unknown as PrismaService,
            organizationsService as unknown as OrganizationsService,
        );
    });

    it("creates a project in an organization the caller can access and adds them as owner", async () => {
        prismaService.client.project.create.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: "ap-southeast-1",
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
            environments: [{ id: "env_1", name: "production", isDefault: true }],
        });

        const created = await service.create(userContext, {
            name: "Arena",
            slug: "arena",
            organizationId: "org_1",
            defaultRegion: "ap-southeast-1",
            environments: ["production"],
        });

        expect(organizationsService.assertAccess).toHaveBeenCalledWith(userContext, "org_1");
        expect(prismaService.client.project.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    organizationId: "org_1",
                    members: { create: { userId: "user_1", role: ProjectMemberRole.OWNER } },
                }),
            }),
        );
        expect(created.organization.id).toBe("org_1");
    });

    it("propagates a forbidden error when the caller cannot access the organization", async () => {
        organizationsService.assertAccess.mockRejectedValue(new ForbiddenException());

        await expect(
            service.create(userContext, { name: "Arena", slug: "arena", organizationId: "org_other" }),
        ).rejects.toBeInstanceOf(ForbiddenException);

        expect(prismaService.client.project.create).not.toHaveBeenCalled();
    });

    it("scopes the project list to orgs where the caller is OWNER/ADMIN or projects they're a member of", () => {
        prismaService.client.project.findMany.mockResolvedValue([]);

        void service.findAll(userContext);

        expect(prismaService.client.project.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    OR: [
                        {
                            organization: {
                                members: {
                                    some: {
                                        userId: "user_1",
                                        role: { in: [ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN] },
                                    },
                                },
                            },
                        },
                        { members: { some: { userId: "user_1" } } },
                    ],
                },
            }),
        );
    });

    it("returns every project for a super-admin", () => {
        prismaService.client.project.findMany.mockResolvedValue([]);

        void service.findAll({ isSuperAdmin: true });

        expect(prismaService.client.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it("asserts access and sanitizes webhook secrets from project detail responses", async () => {
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
        prismaService.client.project.findUnique.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: null,
            organizationId: "org_1",
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

        const project = await service.findOne(userContext, "project_1");

        expect(prismaService.client.organizationMember.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { organizationId_userId: { organizationId: "org_1", userId: "user_1" } },
            }),
        );
        expect(project.webhookEndpoints[0]).toEqual(expect.objectContaining({ id: "wh_1", hasSecret: true }));
        expect(project.webhookEndpoints[0]).not.toHaveProperty("secret");
    });

    it("allows an org MEMBER who is a project member", async () => {
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.project.findUnique.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: null,
            organizationId: "org_1",
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            updatedAt: new Date("2026-06-12T00:00:00.000Z"),
            organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
            environments: [],
            members: [
                {
                    id: "pm_1",
                    role: ProjectMemberRole.MEMBER,
                    createdAt: new Date(),
                    userId: "user_1",
                    user: { id: "user_1", email: "a@b.com", name: null },
                },
            ],
            webhookEndpoints: [],
        });

        await expect(service.findOne(userContext, "project_1")).resolves.toEqual(
            expect.objectContaining({ id: "project_1" }),
        );
    });

    it("rejects an org MEMBER with no matching ProjectMember row", async () => {
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.project.findUnique.mockResolvedValue({
            id: "project_1",
            name: "Arena",
            slug: "arena",
            defaultRegion: null,
            organizationId: "org_1",
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            updatedAt: new Date("2026-06-12T00:00:00.000Z"),
            organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
            environments: [],
            members: [
                {
                    id: "pm_2",
                    role: ProjectMemberRole.MEMBER,
                    createdAt: new Date(),
                    userId: "someone_else",
                    user: { id: "someone_else", email: "c@d.com", name: null },
                },
            ],
            webhookEndpoints: [],
        });

        await expect(service.findOne(userContext, "project_1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws when the project does not exist", async () => {
        prismaService.client.project.findUnique.mockResolvedValue(null);

        await expect(service.findOne(userContext, "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
});
