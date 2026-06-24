import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
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
    });
});