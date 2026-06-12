import { ConflictException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMembersService } from "./project-members.service";

describe("ProjectMembersService", () => {
    let service: ProjectMembersService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            user: { upsert: jest.Mock };
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

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                user: { upsert: jest.fn() },
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

    it("creates a project member for an existing project", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ id: "project_1" });
        prismaService.client.user.upsert.mockResolvedValue({
            id: "user_1",
            email: "member@example.com",
            name: "Member",
        });
        prismaService.client.projectMember.findUnique.mockResolvedValue(null);
        prismaService.client.projectMember.create.mockResolvedValue({
            id: "member_1",
            role: ProjectMemberRole.ADMIN,
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            user: {
                id: "user_1",
                email: "member@example.com",
                name: "Member",
            },
        });

        const created = await service.create("project_1", {
            email: "member@example.com",
            name: "Member",
            role: ProjectMemberRole.ADMIN,
        });

        expect(created.role).toBe(ProjectMemberRole.ADMIN);
        expect(prismaService.client.projectMember.create).toHaveBeenCalled();
    });

    it("prevents removing the last project owner", async () => {
        prismaService.client.projectMember.findFirst.mockResolvedValue({
            id: "member_1",
            projectId: "project_1",
            role: ProjectMemberRole.OWNER,
            user: {
                id: "user_1",
                email: "owner@example.com",
                name: "Owner",
            },
        });
        prismaService.client.projectMember.count.mockResolvedValue(1);

        await expect(service.remove("project_1", "member_1")).rejects.toBeInstanceOf(ConflictException);
        expect(prismaService.client.projectMember.delete).not.toHaveBeenCalled();
    });

    it("fails when project member does not exist", async () => {
        prismaService.client.projectMember.findFirst.mockResolvedValue(null);

        await expect(
            service.update("project_1", "member_missing", { role: ProjectMemberRole.ADMIN }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });
});