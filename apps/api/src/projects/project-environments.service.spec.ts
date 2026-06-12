import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectEnvironmentsService } from "./project-environments.service";

describe("ProjectEnvironmentsService", () => {
    let service: ProjectEnvironmentsService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            projectEnvironment: {
                findMany: jest.Mock;
                findUnique: jest.Mock;
                findFirst: jest.Mock;
                count: jest.Mock;
                delete: jest.Mock;
                update: jest.Mock;
                updateMany: jest.Mock;
                create: jest.Mock;
            };
            $transaction: jest.Mock;
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                projectEnvironment: {
                    findMany: jest.fn(),
                    findUnique: jest.fn(),
                    findFirst: jest.fn(),
                    count: jest.fn(),
                    delete: jest.fn(),
                    update: jest.fn(),
                    updateMany: jest.fn(),
                    create: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };

        prismaService.client.$transaction.mockImplementation(
            async (callback: (tx: typeof prismaService.client) => unknown) => callback(prismaService.client),
        );

        service = new ProjectEnvironmentsService(prismaService as unknown as PrismaService);
    });

    it("normalizes names when creating a project environment", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ id: "project_1" });
        prismaService.client.projectEnvironment.findUnique.mockResolvedValue(null);
        prismaService.client.projectEnvironment.create.mockResolvedValue({
            id: "env_1",
            name: "production",
            isDefault: false,
        });

        await service.create("project_1", {
            name: " Production ",
        });

        expect(prismaService.client.projectEnvironment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: "production",
                }),
            }),
        );
    });

    it("prevents deleting the default environment", async () => {
        prismaService.client.projectEnvironment.findFirst.mockResolvedValue({
            id: "env_1",
            projectId: "project_1",
            name: "production",
            isDefault: true,
        });
        prismaService.client.projectEnvironment.count.mockResolvedValue(2);

        await expect(service.remove("project_1", "env_1")).rejects.toBeInstanceOf(ConflictException);
        expect(prismaService.client.projectEnvironment.delete).not.toHaveBeenCalled();
    });
});