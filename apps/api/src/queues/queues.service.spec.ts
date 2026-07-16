import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { MatchStructure, QueueEntryStatus, RatingMode } from "../generated/prisma/enums";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { GameModesService } from "../game-modes/game-modes.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectEnvironmentsService } from "../projects/project-environments.service";
import { QueuesService } from "./queues.service";

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe("QueuesService", () => {
    let service: QueuesService;
    let prismaService: {
        client: {
            queueEntry: {
                findFirst: jest.Mock;
                update: jest.Mock;
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
                    update: jest.fn(),
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

    describe("enqueue", () => {
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
            expect(prismaService.client.$queryRaw).not.toHaveBeenCalled();
        });

        it("normalizes the environment, inserts via a single raw query, and returns matchId: null synchronously", async () => {
            prismaService.client.projectEnvironment.findUnique.mockResolvedValue({ name: "production" });
            gameModesService.findOne.mockResolvedValue({
                id: "mode_1",
                teamSizeMin: 1,
                teamSizeMax: 2,
                ratingMode: RatingMode.DISABLED,
            });
            prismaService.client.queueEntry.findFirst.mockResolvedValue(null);
            prismaService.client.$queryRaw.mockResolvedValue([
                {
                    queueEntryId: "entry_1",
                    queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                    matchPoolId: "pool_1",
                    teamId: "team_1",
                },
            ]);
            // Background fire-and-forget match-making attempt; its outcome isn't
            // under test here, an unconfigured mock resolving `undefined` is enough
            // for tryCreateMatch to no-op cleanly.
            prismaService.client.$transaction.mockResolvedValue(undefined);

            const result = await service.enqueue("project_1", {
                projectId: "project_1",
                gameModeId: "mode_1",
                environment: " Production ",
                team: {
                    members: [{ playerId: "player_1" }],
                },
            });

            expect(result).toEqual({
                queueEntryId: "entry_1",
                status: "queued",
                poolKey: "project_1:production:mode_1:global",
                queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                matchId: null,
            });

            const [sqlArg] = prismaService.client.$queryRaw.mock.calls[0] as [{ values: unknown[] }];
            expect(sqlArg.values).toContain("production");
            expect(sqlArg.values).not.toContain(" Production ");
        });

        it("resolves with matchId: null and does not crash when the background match-making attempt fails", async () => {
            const errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

            prismaService.client.projectEnvironment.findUnique.mockResolvedValue({ name: "production" });
            gameModesService.findOne.mockResolvedValue({
                id: "mode_1",
                teamSizeMin: 1,
                teamSizeMax: 2,
                ratingMode: RatingMode.DISABLED,
            });
            prismaService.client.queueEntry.findFirst.mockResolvedValue(null);
            prismaService.client.$queryRaw.mockResolvedValue([
                {
                    queueEntryId: "entry_1",
                    queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                    matchPoolId: "pool_1",
                    teamId: "team_1",
                },
            ]);
            prismaService.client.$transaction.mockRejectedValue(new Error("connection lost"));

            const result = await service.enqueue("project_1", {
                projectId: "project_1",
                gameModeId: "mode_1",
                environment: "production",
                team: {
                    members: [{ playerId: "player_1" }],
                },
            });

            expect(result.matchId).toBeNull();

            // Let the un-awaited background promise's rejection propagate to its .catch().
            await flushMicrotasks();
            await flushMicrotasks();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining("Background match-making failed"),
                expect.any(Error),
            );

            errorSpy.mockRestore();
        });
    });

    describe("dequeue", () => {
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
    });

    describe("getQueueEntry", () => {
        it("returns the current state of a queue entry, including matchId once matched", async () => {
            prismaService.client.queueEntry.findFirst.mockResolvedValue({
                id: "entry_1",
                projectId: "project_1",
                environment: "production",
                gameModeId: "mode_1",
                regionKey: "global",
                status: QueueEntryStatus.MATCHED,
                queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                matchSlots: [{ match: { id: "match_1" } }],
            });

            const result = await service.getQueueEntry("project_1", "entry_1");

            expect(result).toEqual({
                queueEntryId: "entry_1",
                status: "matched",
                poolKey: "project_1:production:mode_1:global",
                queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                matchId: "match_1",
            });
        });

        it("throws NotFoundException for a queue entry outside the caller's project", async () => {
            prismaService.client.queueEntry.findFirst.mockResolvedValue(null);

            await expect(service.getQueueEntry("project_1", "entry_1")).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("tryCreateMatch", () => {
        it("returns null when the pool's environment is no longer configured", async () => {
            const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
            prismaService.client.$transaction.mockImplementation(async (callback: (...args: unknown[]) => unknown) =>
                callback(tx),
            );
            tx.$queryRaw.mockResolvedValueOnce([
                {
                    poolId: "pool_1",
                    requiredSlots: 2,
                    environmentConfigured: false,
                },
            ]);

            const matchId = await service.tryCreateMatch("pool_1");

            expect(matchId).toBeNull();
            expect(tx.$executeRaw).not.toHaveBeenCalled();
        });

        it("returns null when fewer candidates are locked than the mode requires", async () => {
            const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn() };
            prismaService.client.$transaction.mockImplementation(async (callback: (...args: unknown[]) => unknown) =>
                callback(tx),
            );
            tx.$queryRaw
                .mockResolvedValueOnce([
                    {
                        poolId: "pool_1",
                        projectId: "project_1",
                        environment: "production",
                        regionKey: "global",
                        gameModeId: "mode_1",
                        ratingMode: RatingMode.DISABLED,
                        requiredSlots: 2,
                        groupCount: 1,
                        matchStructure: MatchStructure.VERSUS,
                        initialRatingWindow: null,
                        windowExpandIntervalSeconds: null,
                        windowExpandStep: null,
                        environmentConfigured: true,
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                        members: [{ playerId: "p1", ratingSnapshot: null }],
                    },
                ]);

            const matchId = await service.tryCreateMatch("pool_1");

            expect(matchId).toBeNull();
            expect(tx.$executeRaw).not.toHaveBeenCalled();
        });

        it("collapses match+slots+status-update into a single write when enough candidates are locked", async () => {
            const tx = { $queryRaw: jest.fn(), $executeRaw: jest.fn().mockResolvedValue(undefined) };
            prismaService.client.$transaction.mockImplementation(async (callback: (...args: unknown[]) => unknown) =>
                callback(tx),
            );
            tx.$queryRaw
                .mockResolvedValueOnce([
                    {
                        poolId: "pool_1",
                        projectId: "project_1",
                        environment: "production",
                        regionKey: "global",
                        gameModeId: "mode_1",
                        ratingMode: RatingMode.DISABLED,
                        requiredSlots: 2,
                        groupCount: 1,
                        matchStructure: MatchStructure.VERSUS,
                        initialRatingWindow: null,
                        windowExpandIntervalSeconds: null,
                        windowExpandStep: null,
                        environmentConfigured: true,
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: "entry_1",
                        teamId: "team_1",
                        queuedAt: new Date("2026-06-12T00:00:00.000Z"),
                        members: [{ playerId: "p1", ratingSnapshot: null }],
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date("2026-06-12T00:00:01.000Z"),
                        members: [{ playerId: "p2", ratingSnapshot: null }],
                    },
                ]);

            const matchId = await service.tryCreateMatch("pool_1");

            expect(typeof matchId).toBe("string");
            expect(matchId).not.toHaveLength(0);
            expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        });
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

        it("slides the anchor past an out-of-range head so pairs behind it still match", () => {
            // Head (1500) queued 5s ago: window 50 covers neither 1119. Under a
            // fixed anchor this pool would deadlock until the head's window grew;
            // the sliding anchor lets the identical 1119s pair immediately.
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_head",
                        teamId: "team_head",
                        queuedAt: new Date(Date.now() - 5000),
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1500 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date(Date.now() - 4000),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1119 }] },
                    },
                    {
                        id: "entry_3",
                        teamId: "team_3",
                        queuedAt: new Date(Date.now() - 3000),
                        team: { members: [{ playerId: "p3", ratingSnapshot: 1119 }] },
                    },
                ],
                { ...baseGameMode, initialRatingWindow: 50, windowExpandIntervalSeconds: 15, windowExpandStep: 50 },
            );

            expect(selected.map((entry) => entry.id)).toEqual(["entry_2", "entry_3"]);
        });

        it("still gives the longest-waiting anchor first claim when it can fill a match", () => {
            // Head (1000, window 50) covers 1030, so it must match first even
            // though 1030 and 1031 are closer to each other.
            const selected = service["selectCandidateQueueEntries"](
                [
                    {
                        id: "entry_head",
                        teamId: "team_head",
                        queuedAt: new Date(Date.now() - 5000),
                        team: { members: [{ playerId: "p1", ratingSnapshot: 1000 }] },
                    },
                    {
                        id: "entry_2",
                        teamId: "team_2",
                        queuedAt: new Date(Date.now() - 4000),
                        team: { members: [{ playerId: "p2", ratingSnapshot: 1030 }] },
                    },
                    {
                        id: "entry_3",
                        teamId: "team_3",
                        queuedAt: new Date(Date.now() - 3000),
                        team: { members: [{ playerId: "p3", ratingSnapshot: 1031 }] },
                    },
                ],
                { ...baseGameMode, initialRatingWindow: 50, windowExpandIntervalSeconds: 15, windowExpandStep: 50 },
            );

            expect(selected.map((entry) => entry.id)).toEqual(["entry_head", "entry_2"]);
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
