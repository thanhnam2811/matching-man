import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { MatchStatus, RatingMode } from "../generated/prisma/enums";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import { RatingsService } from "../ratings/ratings.service";
import { MatchesService } from "./matches.service";

const makeMatch = (overrides: object = {}) => ({
    id: "match_1",
    projectId: "project_1",
    gameModeId: "mode_1",
    status: MatchStatus.CREATED,
    ratingMode: RatingMode.DISABLED,
    environment: "production",
    regionKey: "global",
    requiredSlots: 2,
    groupCount: 2,
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
    result: null,
    slots: [
        {
            slotIndex: 1,
            groupIndex: 1,
            teamId: "team_1",
            teamSnapshot: [{ playerId: "player_1", rating: 1010 }],
        },
        {
            slotIndex: 2,
            groupIndex: 2,
            teamId: "team_2",
            teamSnapshot: [{ playerId: "player_2", rating: 990 }],
        },
    ],
    ...overrides,
});

describe("MatchesService", () => {
    let service: MatchesService;
    let prismaService: {
        client: {
            match: { findFirst: jest.Mock; update: jest.Mock; findMany: jest.Mock; count: jest.Mock };
            matchResult: { create: jest.Mock };
            $transaction: jest.Mock;
        };
    };
    let webhookDeliveryService: { scheduleDelivery: jest.Mock };
    let ratingsService: { applyEloForVersusMatch: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                match: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
                matchResult: {
                    create: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };

        webhookDeliveryService = { scheduleDelivery: jest.fn() };
        ratingsService = { applyEloForVersusMatch: jest.fn() };

        service = new MatchesService(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
            ratingsService as unknown as RatingsService,
        );
    });

    describe("findOne", () => {
        it("reads team members from immutable slot snapshots", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(makeMatch());

            const match = await service.findOne("project_1", "match_1");

            expect(match.slots[0].members).toEqual([{ playerId: "player_1", rating: 1010 }]);
        });

        it("throws when the match does not exist", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(null);

            await expect(service.findOne("project_1", "missing")).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("listMatches", () => {
        it("scopes the query to the project and lowercases enum fields", async () => {
            prismaService.client.match.findMany.mockResolvedValue([
                {
                    id: "match_1",
                    gameModeId: "mode_1",
                    status: MatchStatus.COMPLETED,
                    environment: "production",
                    regionKey: "global",
                    requiredSlots: 2,
                    groupCount: 2,
                    ratingMode: RatingMode.INTERNAL_ELO,
                    createdAt: new Date("2026-06-12T00:00:00.000Z"),
                    result: { winnerGroupIndex: 1, endedAt: new Date("2026-06-12T00:25:00.000Z") },
                },
            ]);
            prismaService.client.match.count.mockResolvedValue(1);

            const result = await service.listMatches("project_1", {});

            expect(prismaService.client.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ projectId: "project_1" }) }),
            );
            expect(result.total).toBe(1);
            expect(result.data[0]).toEqual(
                expect.objectContaining({
                    id: "match_1",
                    status: "completed",
                    ratingMode: "internal_elo",
                    region: "global",
                    result: { winnerGroupIndex: 1, endedAt: new Date("2026-06-12T00:25:00.000Z") },
                }),
            );
        });

        it("applies status, gameMode, and time-range filters", async () => {
            prismaService.client.match.findMany.mockResolvedValue([]);
            prismaService.client.match.count.mockResolvedValue(0);

            await service.listMatches("project_1", {
                gameModeId: "mode_1",
                status: MatchStatus.CREATED,
                from: "2026-06-01T00:00:00.000Z",
                to: "2026-06-30T00:00:00.000Z",
            });

            expect(prismaService.client.match.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        projectId: "project_1",
                        gameModeId: "mode_1",
                        status: MatchStatus.CREATED,
                        createdAt: {
                            gte: new Date("2026-06-01T00:00:00.000Z"),
                            lte: new Date("2026-06-30T00:00:00.000Z"),
                        },
                    },
                }),
            );
        });

        it("returns null result for matches without a recorded outcome", async () => {
            prismaService.client.match.findMany.mockResolvedValue([
                {
                    id: "match_2",
                    gameModeId: "mode_1",
                    status: MatchStatus.CREATED,
                    environment: "production",
                    regionKey: "global",
                    requiredSlots: 2,
                    groupCount: 2,
                    ratingMode: RatingMode.DISABLED,
                    createdAt: new Date("2026-06-12T00:00:00.000Z"),
                    result: null,
                },
            ]);
            prismaService.client.match.count.mockResolvedValue(1);

            const result = await service.listMatches("project_1", {});

            expect(result.data[0].result).toBeNull();
        });
    });

    describe("reportResult", () => {
        it("throws when match does not exist", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(null);

            await expect(
                service.reportResult("project_1", "match_1", { endedAt: "2026-06-12T01:00:00Z" }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it("replays response when match already has a result", async () => {
            const existingResult = {
                matchId: "match_1",
                winnerGroupIndex: 1,
                endedAt: new Date("2026-06-12T01:00:00Z"),
                createdAt: new Date(),
            };
            prismaService.client.match.findFirst.mockResolvedValue(makeMatch({ result: existingResult }));

            const response = await service.reportResult("project_1", "match_1", {
                endedAt: "2026-06-12T01:00:00Z",
            });

            expect(response.matchId).toBe("match_1");
            expect(response.ratingUpdateStatus).toBe("skipped");
            expect(prismaService.client.$transaction).not.toHaveBeenCalled();
        });

        it("throws ConflictException when match is already completed", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(
                makeMatch({ status: MatchStatus.COMPLETED, result: null }),
            );

            await expect(
                service.reportResult("project_1", "match_1", { endedAt: "2026-06-12T01:00:00Z" }),
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it("throws BadRequestException when winnerGroupIndex exceeds groupCount", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(makeMatch());

            await expect(
                service.reportResult("project_1", "match_1", {
                    winnerGroupIndex: 5,
                    endedAt: "2026-06-12T01:00:00Z",
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });

        it("creates result and fires match.completed webhook for DISABLED rating mode", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(makeMatch());
            const createdResult = {
                matchId: "match_1",
                winnerGroupIndex: 1,
                endedAt: new Date("2026-06-12T01:00:00Z"),
                createdAt: new Date(),
            };
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchResult.create.mockResolvedValue(createdResult);
                    return fn(prismaService.client);
                },
            );

            const response = await service.reportResult("project_1", "match_1", {
                winnerGroupIndex: 1,
                endedAt: "2026-06-12T01:00:00Z",
            });

            expect(response.status).toBe("completed");
            expect(response.ratingUpdateStatus).toBe("skipped");
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                "project_1",
                "match.completed",
                expect.objectContaining({ matchId: "match_1" }),
            );
            expect(ratingsService.applyEloForVersusMatch).not.toHaveBeenCalled();
        });

        it("applies Elo and fires rating.updated when ratingMode is INTERNAL_ELO", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(makeMatch({ ratingMode: RatingMode.INTERNAL_ELO }));
            const createdResult = {
                matchId: "match_1",
                winnerGroupIndex: 1,
                endedAt: new Date("2026-06-12T01:00:00Z"),
                createdAt: new Date(),
            };
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchResult.create.mockResolvedValue(createdResult);
                    return fn(prismaService.client);
                },
            );
            ratingsService.applyEloForVersusMatch.mockResolvedValue([
                { playerId: "player_1", ratingBefore: 1200, ratingAfter: 1216, delta: 16 },
                { playerId: "player_2", ratingBefore: 1200, ratingAfter: 1184, delta: -16 },
            ]);

            const response = await service.reportResult("project_1", "match_1", {
                winnerGroupIndex: 1,
                endedAt: "2026-06-12T01:00:00Z",
            });

            expect(response.ratingUpdateStatus).toBe("completed");
            expect(ratingsService.applyEloForVersusMatch).toHaveBeenCalledWith(
                "project_1",
                "mode_1",
                "match_1",
                ["player_1"],
                ["player_2"],
            );
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                "project_1",
                "rating.updated",
                expect.objectContaining({ matchId: "match_1" }),
            );
        });
    });
});