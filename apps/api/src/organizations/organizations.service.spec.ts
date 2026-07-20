import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsService", () => {
    let service: OrganizationsService;
    let prismaService: {
        client: {
            organization: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock };
            organizationMember: {
                findUnique: jest.Mock;
                findFirst: jest.Mock;
                create: jest.Mock;
                update: jest.Mock;
                delete: jest.Mock;
                count: jest.Mock;
            };
            project: { findMany: jest.Mock };
            projectMember: { deleteMany: jest.Mock; createMany: jest.Mock };
            user: { findUnique: jest.Mock };
            $transaction: jest.Mock;
        };
    };

    const user = { authUserId: "user_1", isSuperAdmin: false };
    const superAdmin = { isSuperAdmin: true };

    beforeEach(() => {
        prismaService = {
            client: {
                organization: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
                organizationMember: {
                    findUnique: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                    count: jest.fn(),
                },
                project: { findMany: jest.fn() },
                projectMember: { deleteMany: jest.fn(), createMany: jest.fn() },
                user: { findUnique: jest.fn() },
                $transaction: jest.fn(),
            },
        };
        prismaService.client.$transaction.mockImplementation(async (fn: (tx: typeof prismaService.client) => unknown) =>
            fn(prismaService.client),
        );

        service = new OrganizationsService(prismaService as unknown as PrismaService);
    });

    describe("assertAccess", () => {
        it("bypasses membership for a super-admin", async () => {
            await expect(service.assertAccess(superAdmin, "org_1")).resolves.toBeUndefined();
            expect(prismaService.client.organizationMember.findUnique).not.toHaveBeenCalled();
        });

        it("throws when the user is not a member", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue(null);
            await expect(service.assertAccess(user, "org_1")).rejects.toBeInstanceOf(ForbiddenException);
        });

        it("throws when the user's role is below the minimum", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
            await expect(service.assertAccess(user, "org_1", ProjectMemberRole.ADMIN)).rejects.toBeInstanceOf(
                ForbiddenException,
            );
        });

        it("allows a sufficient role", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.OWNER });
            await expect(service.assertAccess(user, "org_1", ProjectMemberRole.ADMIN)).resolves.toBeUndefined();
        });
    });

    describe("create", () => {
        it("creates an org and seeds the caller as owner", async () => {
            prismaService.client.organization.findUnique.mockResolvedValue(null);
            prismaService.client.organization.create.mockResolvedValue({ id: "org_1", name: "Acme", slug: "acme" });

            const result = await service.create(user, { name: "Acme" });

            expect(prismaService.client.organizationMember.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { organizationId: "org_1", userId: "user_1", role: ProjectMemberRole.OWNER },
                }),
            );
            expect(result).toEqual({ id: "org_1", name: "Acme", slug: "acme", role: "OWNER" });
        });

        it("requires a user session", async () => {
            await expect(service.create(superAdmin, { name: "Acme" })).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe("addMember", () => {
        beforeEach(() => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.OWNER });
        });

        it("rejects an email with no registered user", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);
            await expect(
                service.addMember(user, "org_1", { email: "ghost@example.com", role: ProjectMemberRole.MEMBER }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it("rejects a user who is already a member", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_2" });
            // second findUnique call is the membership existence check
            prismaService.client.organizationMember.findUnique
                .mockResolvedValueOnce({ role: ProjectMemberRole.OWNER })
                .mockResolvedValueOnce({ id: "member_existing" });

            await expect(
                service.addMember(user, "org_1", { email: "u2@example.com", role: ProjectMemberRole.MEMBER }),
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it("maps a racing duplicate insert (P2002) to a 409 instead of a raw 500", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_2" });
            prismaService.client.organizationMember.findUnique
                .mockResolvedValueOnce({ role: ProjectMemberRole.OWNER })
                .mockResolvedValueOnce(null);
            prismaService.client.organizationMember.create.mockRejectedValue(
                new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
                    code: "P2002",
                    clientVersion: "0.0.0",
                }),
            );

            await expect(
                service.addMember(user, "org_1", { email: "u2@example.com", role: ProjectMemberRole.MEMBER }),
            ).rejects.toBeInstanceOf(ConflictException);
        });
    });

    describe("checkMemberEmail", () => {
        beforeEach(() => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
        });

        it("reports true for a registered email", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_2" });

            await expect(service.checkMemberEmail(user, "org_1", "Member@Example.com")).resolves.toEqual({
                exists: true,
            });
            expect(prismaService.client.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: "member@example.com" } }),
            );
        });

        it("reports false for an unregistered email", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);

            await expect(service.checkMemberEmail(user, "org_1", "ghost@example.com")).resolves.toEqual({
                exists: false,
            });
        });

        it("requires org ADMIN+ to probe emails", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });

            await expect(service.checkMemberEmail(user, "org_1", "someone@example.com")).rejects.toBeInstanceOf(
                ForbiddenException,
            );
            expect(prismaService.client.user.findUnique).not.toHaveBeenCalled();
        });
    });

    describe("removeMember", () => {
        it("refuses to remove the last owner", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.OWNER });
            prismaService.client.organizationMember.findFirst.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.OWNER,
            });
            prismaService.client.organizationMember.count.mockResolvedValue(1);

            await expect(service.removeMember(user, "org_1", "member_1")).rejects.toBeInstanceOf(BadRequestException);
            expect(prismaService.client.organizationMember.delete).not.toHaveBeenCalled();
        });

        it("cleans up the user's ProjectMember rows across this org's projects", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.organizationMember.findFirst.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.MEMBER,
                userId: "user_2",
            });

            await expect(service.removeMember(user, "org_1", "member_1")).resolves.toEqual({
                id: "member_1",
                removed: true,
            });

            expect(prismaService.client.projectMember.deleteMany).toHaveBeenCalledWith({
                where: { userId: "user_2", project: { organizationId: "org_1" } },
            });
            expect(prismaService.client.organizationMember.delete).toHaveBeenCalledWith({
                where: { id: "member_1" },
            });
        });
    });

    describe("updateMember", () => {
        it("backfills MEMBER-level ProjectMember rows when demoting out of org ADMIN+ blanket access", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.OWNER });
            prismaService.client.organizationMember.findFirst.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.ADMIN,
                userId: "user_2",
            });
            prismaService.client.project.findMany.mockResolvedValue([{ id: "project_1" }, { id: "project_2" }]);
            prismaService.client.organizationMember.update.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.MEMBER,
            });

            await service.updateMember(user, "org_1", "member_1", { role: ProjectMemberRole.MEMBER });

            expect(prismaService.client.project.findMany).toHaveBeenCalledWith({
                where: { organizationId: "org_1" },
                select: { id: true },
            });
            expect(prismaService.client.projectMember.createMany).toHaveBeenCalledWith({
                data: [
                    { projectId: "project_1", userId: "user_2", role: ProjectMemberRole.MEMBER },
                    { projectId: "project_2", userId: "user_2", role: ProjectMemberRole.MEMBER },
                ],
                skipDuplicates: true,
            });
        });

        it("does not backfill when the role change doesn't cross the ADMIN threshold", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.OWNER });
            prismaService.client.organizationMember.findFirst.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.MEMBER,
                userId: "user_2",
            });
            prismaService.client.organizationMember.update.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.ADMIN,
            });

            await service.updateMember(user, "org_1", "member_1", { role: ProjectMemberRole.ADMIN });

            expect(prismaService.client.project.findMany).not.toHaveBeenCalled();
            expect(prismaService.client.projectMember.createMany).not.toHaveBeenCalled();
        });
    });
});
