import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMembersService } from "./project-members.service";

describe("ProjectMembersService", () => {
    let service: ProjectMembersService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            organizationMember: { findUnique: jest.Mock };
            user: { findUnique: jest.Mock };
            projectMember: {
                findMany: jest.Mock;
                findUnique: jest.Mock;
                findFirst: jest.Mock;
                create: jest.Mock;
                update: jest.Mock;
                delete: jest.Mock;
                count: jest.Mock;
            };
        };
    };

    const adminContext = { authUserId: "admin_1", isSuperAdmin: false };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                organizationMember: { findUnique: jest.fn() },
                user: { findUnique: jest.fn() },
                projectMember: {
                    findMany: jest.fn(),
                    findUnique: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                    count: jest.fn(),
                },
            },
        };

        service = new ProjectMembersService(prismaService as unknown as PrismaService);
    });

    describe("create", () => {
        beforeEach(() => {
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
        });

        it("creates a project member for an already-registered user", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({
                id: "user_1",
                email: "member@example.com",
                name: "Member",
            });
            prismaService.client.projectMember.findUnique.mockResolvedValue(null);
            prismaService.client.projectMember.create.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.ADMIN,
                createdAt: new Date("2026-06-12T00:00:00.000Z"),
                user: { id: "user_1", email: "member@example.com", name: "Member" },
            });

            const created = await service.create(adminContext, "project_1", {
                email: "member@example.com",
                role: ProjectMemberRole.ADMIN,
            });

            expect(created.role).toBe(ProjectMemberRole.ADMIN);
            expect(prismaService.client.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: "member@example.com" } }),
            );
            expect(prismaService.client.projectMember.create).toHaveBeenCalled();
        });

        it("rejects invites for an email with no registered account", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);

            await expect(
                service.create(adminContext, "project_1", {
                    email: "nobody@example.com",
                    role: ProjectMemberRole.MEMBER,
                }),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(prismaService.client.projectMember.create).not.toHaveBeenCalled();
        });
    });

    describe("remove", () => {
        it("prevents removing the last project owner", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findFirst.mockResolvedValue({
                id: "member_1",
                projectId: "project_1",
                role: ProjectMemberRole.OWNER,
                user: { id: "user_1", email: "owner@example.com", name: "Owner" },
            });
            prismaService.client.projectMember.count.mockResolvedValue(1);

            await expect(service.remove(adminContext, "project_1", "member_1")).rejects.toBeInstanceOf(
                ConflictException,
            );
            expect(prismaService.client.projectMember.delete).not.toHaveBeenCalled();
        });

        it("allows a caller who is a project ADMIN without an elevated org role", async () => {
            const projectAdminContext = { authUserId: "project_admin_1", isSuperAdmin: false };
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.projectMember.findFirst.mockResolvedValue({
                id: "member_2",
                projectId: "project_1",
                role: ProjectMemberRole.MEMBER,
                user: { id: "user_2", email: "member@example.com", name: null },
            });

            await expect(service.remove(projectAdminContext, "project_1", "member_2")).resolves.toEqual(
                expect.objectContaining({ id: "member_2", deleted: true }),
            );
        });

        it("rejects a caller who is neither an org admin nor a project admin", async () => {
            const plainMemberContext = { authUserId: "user_3", isSuperAdmin: false };
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });

            await expect(service.remove(plainMemberContext, "project_1", "member_2")).rejects.toBeInstanceOf(
                ForbiddenException,
            );
            expect(prismaService.client.projectMember.delete).not.toHaveBeenCalled();
        });
    });

    describe("update", () => {
        it("fails when project member does not exist", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findFirst.mockResolvedValue(null);

            await expect(
                service.update(adminContext, "project_1", "member_missing", { role: ProjectMemberRole.ADMIN }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
