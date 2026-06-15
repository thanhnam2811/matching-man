import { BadRequestException } from "@nestjs/common";
import { MatchStructure, QueueEntryStatus, RatingMode } from "../generated/prisma/enums";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
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
                update: jest.Mock;
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
    let webhookDeliveryService: {
        scheduleDelivery: jest.Mock;
    };
    let projectEnvironmentsService: ProjectEnvironmentsService;

    beforeEach(() => {
        prismaService = {
            client: {
                queueEntry: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    findUniqueOrThrow: jest.fn(),
                    update: jest.fn(),
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

        webhookDeliveryService = {
            scheduleDelivery: jest.fn(),
        };

        projectEnvironmentsService = new ProjectEnvironmentsService(prismaService as unknown as PrismaService);
        service = new QueuesService(
            prismaService as unknown as PrismaService,
            gameModesService as unknown as GameModesService,
            projectEnvironmentsService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
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
        prismaService.client.$transaction.mockImplementation(
            async (callback: (tx: typeof prismaService.client) => unknown) => callback(prismaService.client),
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
                initialRatingWindow: null,
                windowExpandIntervalSeconds: null,
                windowExpandStep: null,
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

    it("replays dequeue response for an existing idempotency key", async () => {
        prismaService.client.queueEntry.findFirst
            .mockResolvedValueOnce({
                id: "entry_1",
                projectId: "project_1",
                dequeueIdempotencyKey: "deq_1",
                status: QueueEntryStatus.CANCELLED,
            })
            .mockResolvedValueOnce(null);

        const result = await service.dequeue("project_1", {
            queueEntryId: "entry_1",
            idempotencyKey: "deq_1",
        });

        expect(result).toEqual({
            queueEntryId: "entry_1",
            status: "cancelled",
        });
        expect(prismaService.client.queueEntry.update).not.toHaveBeenCalled();
    });

    it("stores dequeue idempotency metadata when cancelling a queued entry", async () => {
        prismaService.client.queueEntry.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: "entry_1",
            projectId: "project_1",
            status: QueueEntryStatus.QUEUED,
        });
        prismaService.client.queueEntry.update.mockResolvedValue({
            id: "entry_1",
            status: QueueEntryStatus.CANCELLED,
        });

        const result = await service.dequeue("project_1", {
            queueEntryId: "entry_1",
            idempotencyKey: "deq_2",
            reason: "party_cancelled",
        });

        expect(result.status).toBe("cancelled");
        expect(prismaService.client.queueEntry.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    dequeueIdempotencyKey: "deq_2",
                    cancelReason: "party_cancelled",
                }),
            }),
        );
    });

    describe("selectCandidateQueueEntries", () => {
        const baseGameMode = {
            ratingMode: RatingMode.EXTERNAL_RATING,
            requiredSlots: 2,
            initialRatingWindow: null,
            windowExpandIntervalSeconds: null,
            windowExpandStep: null,
        };

        it("selects closest-rated candidates when no window is configured", () => {
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1000 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date("2026-06-12T00:00:01.000Z"),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1600 }] },
                    },
                    {
                        id: "entry_3",
                        teamId: "team_3",
                        queuedAt: new Date("2026-06-12T00:00:02.000Z"),
                        team: { members: [{ playerId: "p3", ratingSnapshot: 1020 }] },
                    },
                ],
                baseGameMode,
            );

            expect(selected.map((entry) => entry.id)).toEqual(["entry_1", "entry_3"]);
        });

        it("returns empty when DISABLED mode has fewer candidates than required slots", () => {
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                        team: { members: [{ playerId: "p1", ratingSnapshot: null }] },
                    },
                ],
                { ...baseGameMode, ratingMode: RatingMode.DISABLED },
            );

            expect(selected).toHaveLength(0);
        });

        it("filters candidates outside the effective rating window", () => {
            const anchor = new Date(Date.now() - 5000); // queued 5s ago
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: anchor,
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1000 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date(Date.now() - 4000),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1100 }] }, // delta 100 > window 50
                    },
                    {
                        id: "entry_3",
                        teamId: "team_3",
                        queuedAt: new Date(Date.now() - 3000),
                        team: { members: [{ playerId: "p3", ratingSnapshot: 1030 }] }, // delta 30 <= window 50
                    },
                ],
                { ...baseGameMode, initialRatingWindow: 50, windowExpandIntervalSeconds: 15, windowExpandStep: 50 },
            );

            expect(selected.map((entry) => entry.id)).toEqual(["entry_1", "entry_3"]);
        });

        it("returns empty when no candidates fall within the rating window", () => {
            const anchor = new Date(Date.now() - 5000); // queued 5s ago, window = 50
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: anchor,
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1000 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date(Date.now() - 4000),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1200 }] }, // delta 200 > window 50
                    },
                ],
                { ...baseGameMode, initialRatingWindow: 50, windowExpandIntervalSeconds: 15, windowExpandStep: 50 },
            );

            expect(selected).toHaveLength(0);
        });

        it("expands the window as the anchor entry waits longer", () => {
            // anchor queued 20s ago: initial 50 + 1 expansion (20/15=1) * 50 = 100
            const anchor = new Date(Date.now() - 20000);
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: anchor,
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1000 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date(Date.now() - 4000),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1090 }] }, // delta 90 <= expanded window 100
                    },
                ],
                { ...baseGameMode, initialRatingWindow: 50, windowExpandIntervalSeconds: 15, windowExpandStep: 50 },
            );

            expect(selected.map((entry) => entry.id)).toEqual(["entry_1", "entry_2"]);
        });
    });
});