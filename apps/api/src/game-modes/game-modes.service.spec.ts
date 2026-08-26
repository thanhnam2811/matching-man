import { MatchStructure, RatingMode } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GameModesService } from "./game-modes.service";

describe("GameModesService", () => {
    let service: GameModesService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            gameMode: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn().mockResolvedValue({ id: "proj_1" }) },
                gameMode: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
            },
        };
        service = new GameModesService(prismaService as unknown as PrismaService);
    });

    it("creates a game mode with ready check enabled and custom timeout", async () => {
        prismaService.client.gameMode.create.mockResolvedValue({
            id: "gm_1",
            projectId: "proj_1",
            key: "ranked-5v5",
            name: "Ranked 5v5",
            matchStructure: MatchStructure.VERSUS,
            requiredSlots: 10,
            groupCount: 2,
            teamSizeMin: 5,
            teamSizeMax: 5,
            ratingMode: RatingMode.DISABLED,
            enableReadyCheck: true,
            readyCheckTimeoutSeconds: 30,
        });

        const result = await service.create("proj_1", {
            key: "ranked-5v5",
            name: "Ranked 5v5",
            matchStructure: MatchStructure.VERSUS,
            requiredSlots: 10,
            groupCount: 2,
            teamSizeMin: 5,
            teamSizeMax: 5,
            enableReadyCheck: true,
            readyCheckTimeoutSeconds: 30,
        });

        expect(result.enableReadyCheck).toBe(true);
        expect(result.readyCheckTimeoutSeconds).toBe(30);
        expect(prismaService.client.gameMode.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                enableReadyCheck: true,
                readyCheckTimeoutSeconds: 30,
            }),
        });
    });

    it("defaults enableReadyCheck to false and timeout to 20 when omitted", async () => {
        prismaService.client.gameMode.create.mockResolvedValue({
            id: "gm_2",
            projectId: "proj_1",
            key: "casual-1v1",
            name: "Casual 1v1",
            matchStructure: MatchStructure.VERSUS,
            requiredSlots: 2,
            groupCount: 2,
            teamSizeMin: 1,
            teamSizeMax: 1,
            ratingMode: RatingMode.DISABLED,
            enableReadyCheck: false,
            readyCheckTimeoutSeconds: 20,
        });

        await service.create("proj_1", {
            key: "casual-1v1",
            name: "Casual 1v1",
            matchStructure: MatchStructure.VERSUS,
            requiredSlots: 2,
            groupCount: 2,
            teamSizeMin: 1,
            teamSizeMax: 1,
        });

        expect(prismaService.client.gameMode.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                enableReadyCheck: false,
                readyCheckTimeoutSeconds: 20,
            }),
        });
    });
});
