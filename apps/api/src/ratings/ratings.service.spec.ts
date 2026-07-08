import { PrismaService } from "../prisma/prisma.service";
import { RatingsService } from "./ratings.service";

const profileFor = (playerId: string, rating: number) => ({
    id: `profile_${playerId}`,
    projectId: "project_1",
    gameModeId: "mode_1",
    playerId,
    rating,
    gamesPlayed: 0,
});

describe("RatingsService", () => {
    let service: RatingsService;
    let prismaService: {
        client: {
            ratingProfile: { upsert: jest.Mock; update: jest.Mock };
            ratingHistory: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock };
            $transaction: jest.Mock;
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                ratingProfile: {
                    upsert: jest.fn(),
                    update: jest.fn(),
                },
                ratingHistory: {
                    create: jest.fn(),
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };

        prismaService.client.$transaction.mockImplementation(
            async (callback: (tx: typeof prismaService.client) => unknown) => callback(prismaService.client),
        );

        service = new RatingsService(prismaService as unknown as PrismaService);
    });

    describe("applyEloForVersusMatch", () => {
        it("creates a fresh profile at the initial rating (1200) for a first-time player", async () => {
            prismaService.client.ratingProfile.upsert.mockImplementation(({ create }) =>
                Promise.resolve({ id: `profile_${create.playerId}`, ...create }),
            );

            await service.applyEloForVersusMatch("project_1", "mode_1", "match_1", ["player_1"], ["player_2"]);

            expect(prismaService.client.ratingProfile.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ rating: 1200, gamesPlayed: 0 }),
                }),
            );
        });

        it("moves an even-rated winner and loser symmetrically by the same magnitude", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("player_1", 1200))
                .mockResolvedValueOnce(profileFor("player_2", 1200));

            const updates = await service.applyEloForVersusMatch(
                "project_1",
                "mode_1",
                "match_1",
                ["player_1"],
                ["player_2"],
            );

            const winner = updates.find((u) => u.playerId === "player_1")!;
            const loser = updates.find((u) => u.playerId === "player_2")!;

            expect(winner.delta).toBe(16);
            expect(loser.delta).toBe(-16);
            expect(winner.ratingAfter).toBe(1216);
            expect(loser.ratingAfter).toBe(1184);
        });

        it("awards a lower-rated winner a bigger gain than a higher-rated winner would get", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("underdog", 1000))
                .mockResolvedValueOnce(profileFor("favorite", 1400));

            const updates = await service.applyEloForVersusMatch(
                "project_1",
                "mode_1",
                "match_1",
                ["underdog"],
                ["favorite"],
            );

            const winner = updates.find((u) => u.playerId === "underdog")!;
            const loser = updates.find((u) => u.playerId === "favorite")!;

            expect(winner.delta).toBeGreaterThan(16);
            expect(loser.delta).toBeLessThan(-16);
            expect(winner.delta).toBe(-loser.delta);
        });

        it("clamps K-factor delta near zero when the winner was overwhelmingly favored", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("favorite", 2400))
                .mockResolvedValueOnce(profileFor("underdog", 800));

            const updates = await service.applyEloForVersusMatch(
                "project_1",
                "mode_1",
                "match_1",
                ["favorite"],
                ["underdog"],
            );

            const winner = updates.find((u) => u.playerId === "favorite")!;
            const loser = updates.find((u) => u.playerId === "underdog")!;

            // Math.round on a near-zero negative expected-score product can yield -0; normalize via Math.abs.
            expect(Math.abs(winner.delta)).toBe(0);
            expect(Math.abs(loser.delta)).toBe(0);
        });

        it("caps delta magnitude at the K-factor when the winner was a massive underdog", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("underdog", 800))
                .mockResolvedValueOnce(profileFor("favorite", 2400));

            const updates = await service.applyEloForVersusMatch(
                "project_1",
                "mode_1",
                "match_1",
                ["underdog"],
                ["favorite"],
            );

            const winner = updates.find((u) => u.playerId === "underdog")!;
            const loser = updates.find((u) => u.playerId === "favorite")!;

            expect(winner.delta).toBe(32);
            expect(loser.delta).toBe(-32);
        });

        it("weighs each player's own rating against the opposing team average, not the team average symmetrically", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("w1", 1000))
                .mockResolvedValueOnce(profileFor("w2", 1200))
                .mockResolvedValueOnce(profileFor("l1", 1100))
                .mockResolvedValueOnce(profileFor("l2", 1100));

            const updates = await service.applyEloForVersusMatch(
                "project_1",
                "mode_1",
                "match_1",
                ["w1", "w2"],
                ["l1", "l2"],
            );

            // Winner team average (1100) equals loser team average (1100), but each winner's own
            // rating (not the team average) sets their individual expected score, so w1 (underdog
            // within their own team) gains more than w2 (favorite within their own team).
            expect(updates.find((u) => u.playerId === "w1")!.delta).toBe(20);
            expect(updates.find((u) => u.playerId === "w2")!.delta).toBe(12);
            expect(updates.find((u) => u.playerId === "l1")!.delta).toBe(-16);
            expect(updates.find((u) => u.playerId === "l2")!.delta).toBe(-16);
        });

        it("persists updated rating and a rating-history row per player inside a transaction", async () => {
            prismaService.client.ratingProfile.upsert
                .mockResolvedValueOnce(profileFor("player_1", 1200))
                .mockResolvedValueOnce(profileFor("player_2", 1200));

            await service.applyEloForVersusMatch("project_1", "mode_1", "match_1", ["player_1"], ["player_2"]);

            expect(prismaService.client.$transaction).toHaveBeenCalledTimes(1);
            expect(prismaService.client.ratingProfile.update).toHaveBeenCalledWith({
                where: { id: "profile_player_1" },
                data: { rating: 1216, gamesPlayed: { increment: 1 } },
            });
            expect(prismaService.client.ratingHistory.create).toHaveBeenCalledWith({
                data: {
                    ratingProfileId: "profile_player_1",
                    matchId: "match_1",
                    ratingBefore: 1200,
                    ratingAfter: 1216,
                    delta: 16,
                },
            });
        });
    });
});
