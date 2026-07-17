import { ExecutionContext, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ProjectAccessGuard } from "./project-access.guard";

function contextFor(request: unknown): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
}

describe("ProjectAccessGuard", () => {
    let guard: ProjectAccessGuard;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            organizationMember: { findUnique: jest.Mock };
            projectMember: { findUnique: jest.Mock };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                organizationMember: { findUnique: jest.fn() },
                projectMember: { findUnique: jest.fn() },
            },
        };
        guard = new ProjectAccessGuard(prismaService as unknown as PrismaService);
    });

    it("bypasses membership for a super-admin", async () => {
        await expect(guard.canActivate(contextFor({ isSuperAdmin: true, params: { projectId: "p1" } }))).resolves.toBe(
            true,
        );
        expect(prismaService.client.project.findUnique).not.toHaveBeenCalled();
    });

    it("allows an org OWNER/ADMIN without a ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "p1" } })),
        ).resolves.toBe(true);
        expect(prismaService.client.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it("allows an org MEMBER with a matching ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.projectMember.findUnique.mockResolvedValue({ id: "pm_1" });

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "p1" } })),
        ).resolves.toBe(true);
        expect(prismaService.client.projectMember.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { projectId_userId: { projectId: "p1", userId: "user_1" } },
            }),
        );
    });

    it("rejects an org MEMBER without a ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.projectMember.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_2", params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects a non-member of the organization", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_3", params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns 404 for a missing project", async () => {
        prismaService.client.project.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(
                contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "missing" } }),
            ),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects when there is no authenticated user", async () => {
        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
