import { BadRequestException } from "@nestjs/common";
import { MatchStructure, QueueEntryStatus, RatingMode } from "../generated/prisma/client";
import { GameModesService } from "../game-modes/game-modes.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectEnvironmentsService } from "../projects/project-environments.service";
import { QueuesService } from "./queues.service";

describe("QueuesService", () => {
    let service: QueuesService;
    let prismaService: {
        client: {
            queueEntry: {
                findFirst: jest.Mock;
                create: jest.Mock;
                findUniqueOrThrow: jest.Mock;
                updateMany: jest.Mock;
            };
            matchPool: {
                upsert: jest.Mock;
                findUnique: jest.Mock;
            };
            match: {
                create: jest.Mock;
            };
            matchSlot: {
                createMany: jest.Mock;
            };
            team: {
                create: jest.Mock;
                upsert: jest.Mock;
            };
            teamMember: {
                createMany: jest.Mock;
                deleteMany: jest.Mock;
            };
            $transaction: jest.Mock;
            $queryRaw: jest.Mock;
            projectEnvironment: {
                findUnique: jest.Mock;
            };
        };
    };
    let gameModesService: {
        findOne: jest.Mock;
    };
    let projectEnvironmentsService: ProjectEnvironmentsService;

    beforeEach(() => {
        prismaService = {
            client: {
                queueEntry: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    findUniqueOrThrow: jest.fn(),
                    updateMany: jest.fn(),
                },
                matchPool: {
                    upsert: jest.fn(),
                    findUnique: jest.fn(),
                },
                match: {
                    create: jest.fn(),
                },
                matchSlot: {
                    createMany: jest.fn(),
                },
                team: {
                    create: jest.fn(),
                    upsert: jest.fn(),
                },
                teamMember: {
                    createMany: jest.fn(),
                    deleteMany: jest.fn(),
                },
                $transaction: jest.fn(),
                $queryRaw: jest.fn(),
                projectEnvironment: {
                    findUnique: jest.fn(),
                },
            },
        };

        gameModesService = {
            findOne: jest.fn(),
        };

        projectEnvironmentsService = new ProjectEnvironmentsService(prismaService as unknown as PrismaService);
        service = new QueuesService(
            prismaService as unknown as PrismaService,
            gameModesService as unknown as GameModesService,
            projectEnvironmentsService,
        );
    });

    it("rejects enqueue when environment is not configured for the project", async () => {
        prismaService.client.projectEnvironment.findUnique.mockResolvedValue(null);
        gameModesService.findOne.mockResolvedValue({
            id: "mode_1",
            teamSizeMin: 1,
            teamSizeMax: 2,
        });

        await expect(
            service.enqueue("project_1", {
                projectId: "project_1",
                gameModeId: "mode_1",
                environment: "staging",
                team: {
                    members: [{ playerId: "player_1" }],
                },
            }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prismaService.client.queueEntry.findFirst).not.toHaveBeenCalled();
        expect(prismaService.client.$transaction).not.toHaveBeenCalled();
    });

    it("uses the normalized configured environment for pool assignment", async () => {
        prismaService.client.projectEnvironment.findUnique.mockResolvedValue({ name: "production" });
        gameModesService.findOne.mockResolvedValue({
            id: "mode_1",
            teamSizeMin: 1,
            teamSizeMax: 2,
            requiredSlots: 2,
            ratingMode: RatingMode.DISABLED,
            matchStructure: MatchStructure.VERSUS,
            groupCount: 2,
        });
        prismaService.client.queueEntry.findFirst.mockResolvedValue(null);
        prismaService.client.$transaction.mockImplementation(async (callback: (tx: typeof prismaService.client) => unknown) =>
            callback(prismaService.client),
        );
        prismaService.client.matchPool.upsert.mockResolvedValue({ id: "pool_1" });
        prismaService.client.team.create.mockResolvedValue({ id: "team_1" });
        prismaService.client.queueEntry.create.mockResolvedValue({
            id: "entry_1",
            matchPoolId: "pool_1",
            projectId: "project_1",
            environment: "production",
            gameModeId: "mode_1",
            regionKey: "global",
            status: QueueEntryStatus.QUEUED,
            queuedAt: new Date("2026-06-12T00:00:00.000Z"),
            matchSlots: [],
        });
        prismaService.client.matchPool.findUnique.mockResolvedValue({
            id: "pool_1",
            projectId: "project_1",
            gameModeId: "mode_1",
            environment: "production",
            regionKey: "global",
            gameMode: {
                requiredSlots: 2,
                ratingMode: RatingMode.DISABLED,
                matchStructure: MatchStructure.VERSUS,
                groupCount: 2,
            },
        });
        prismaService.client.$queryRaw.mockResolvedValue([]);
        prismaService.client.queueEntry.findUniqueOrThrow.mockResolvedValue({
            id: "entry_1",
            projectId: "project_1",
            environment: "production",
            gameModeId: "mode_1",
            regionKey: "global",
            status: QueueEntryStatus.QUEUED,
            queuedAt: new Date("2026-06-12T00:00:00.000Z"),
            matchSlots: [],
        });

        const result = await service.enqueue("project_1", {
            projectId: "project_1",
            gameModeId: "mode_1",
            environment: " Production ",
            team: {
                members: [{ playerId: "player_1" }],
            },
        });

        expect(prismaService.client.matchPool.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    projectId_gameModeId_environment_regionKey: {
                        projectId: "project_1",
                        gameModeId: "mode_1",
                        environment: "production",
                        regionKey: "global",
                    },
                },
            }),
        );
        expect(result.poolKey).toBe("project_1:production:mode_1:global");
    });
});
