import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { DisputeStatus, MatchStatus, RatingMode } from "../generated/prisma/enums";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import { RatingsService } from "../ratings/ratings.service";
import { DisputesService } from "./disputes.service";
import { CreateMatchDisputeDto } from "./dto/create-match-dispute.dto";
import { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import { RejectDisputeDto } from "./dto/reject-dispute.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

describe("DisputesService", () => {
    let service: DisputesService;
    let prismaService: {
        client: {
            match: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
            matchDispute: {
                create: jest.Mock;
                findFirst: jest.Mock;
                findUnique: jest.Mock;
                findMany: jest.Mock;
                count: jest.Mock;
                update: jest.Mock;
            };
            matchResult: { create: jest.Mock; update: jest.Mock };
            $transaction: jest.Mock;
        };
    };
    let webhookDeliveryService: { scheduleDelivery: jest.Mock };
    let ratingsService: { reconcileEloForDispute: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                match: {
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
                matchDispute: {
                    create: jest.fn(),
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                    findMany: jest.fn(),
                    count: jest.fn(),
                    update: jest.fn(),
                },
                matchResult: {
                    create: jest.fn(),
                    update: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };

        webhookDeliveryService = { scheduleDelivery: jest.fn() };
        ratingsService = { reconcileEloForDispute: jest.fn() };

        service = new DisputesService(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
            ratingsService as unknown as RatingsService,
        );
    });

    describe("createDispute", () => {
        const projectId = "project_1";
        const matchId = "match_1";
        const dto: CreateMatchDisputeDto = {
            claimantTeamId: "team_1",
            reason: "Suspected map hacking",
            evidence: { replayUrl: "https://example.com/replay.dem" },
        };

        it("creates an OPEN dispute for a match, updates match status to DISPUTED, and schedules match.disputed webhook", async () => {
            const match = {
                id: matchId,
                projectId,
                status: MatchStatus.COMPLETED,
            };

            const createdDispute = {
                id: "dispute_1",
                projectId,
                matchId,
                claimantTeamId: dto.claimantTeamId,
                status: DisputeStatus.OPEN,
                reason: dto.reason,
                evidence: dto.evidence,
                overrideWinnerGroupIndex: null,
                resolvedByUserId: null,
                resolvedAt: null,
                resolutionNotes: null,
                createdAt: new Date("2026-08-25T12:00:00.000Z"),
                updatedAt: new Date("2026-08-25T12:00:00.000Z"),
            };

            prismaService.client.match.findFirst.mockResolvedValue(match);
            prismaService.client.matchDispute.findFirst.mockResolvedValue(null);
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchDispute.create.mockResolvedValue(createdDispute);
                    prismaService.client.match.update.mockResolvedValue({ ...match, status: MatchStatus.DISPUTED });
                    return fn(prismaService.client);
                },
            );

            const result = await service.createDispute(projectId, matchId, dto);

            expect(prismaService.client.match.findFirst).toHaveBeenCalledWith({
                where: { id: matchId, projectId },
            });
            expect(prismaService.client.matchDispute.findFirst).toHaveBeenCalledWith({
                where: { matchId, projectId, status: DisputeStatus.OPEN },
            });
            expect(prismaService.client.$transaction).toHaveBeenCalled();
            expect(prismaService.client.matchDispute.create).toHaveBeenCalledWith({
                data: {
                    projectId,
                    matchId,
                    claimantTeamId: "team_1",
                    reason: "Suspected map hacking",
                    evidence: { replayUrl: "https://example.com/replay.dem" },
                    status: DisputeStatus.OPEN,
                },
            });
            expect(prismaService.client.match.update).toHaveBeenCalledWith({
                where: { id: matchId },
                data: { status: MatchStatus.DISPUTED },
            });
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                projectId,
                "match.disputed",
                expect.objectContaining({
                    event: "match.disputed",
                    matchId,
                    disputeId: "dispute_1",
                    claimantTeamId: "team_1",
                    reason: "Suspected map hacking",
                }),
            );
            expect(result).toEqual(createdDispute);
        });

        it("throws NotFoundException when match does not exist", async () => {
            prismaService.client.match.findFirst.mockResolvedValue(null);

            await expect(service.createDispute(projectId, "non_existent", dto)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(prismaService.client.$transaction).not.toHaveBeenCalled();
            expect(webhookDeliveryService.scheduleDelivery).not.toHaveBeenCalled();
        });

        it("throws ConflictException when an OPEN dispute already exists for the match", async () => {
            prismaService.client.match.findFirst.mockResolvedValue({
                id: matchId,
                projectId,
                status: MatchStatus.DISPUTED,
            });
            prismaService.client.matchDispute.findFirst.mockResolvedValue({
                id: "existing_dispute",
                status: DisputeStatus.OPEN,
            });

            await expect(service.createDispute(projectId, matchId, dto)).rejects.toBeInstanceOf(ConflictException);
            expect(prismaService.client.$transaction).not.toHaveBeenCalled();
            expect(webhookDeliveryService.scheduleDelivery).not.toHaveBeenCalled();
        });

        it("handles dispute creation without claimantTeamId and evidence", async () => {
            const minimalDto: CreateMatchDisputeDto = {
                reason: "Server crash during match",
            };

            const match = {
                id: matchId,
                projectId,
                status: MatchStatus.COMPLETED,
            };

            const createdDispute = {
                id: "dispute_2",
                projectId,
                matchId,
                claimantTeamId: null,
                status: DisputeStatus.OPEN,
                reason: minimalDto.reason,
                evidence: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            prismaService.client.match.findFirst.mockResolvedValue(match);
            prismaService.client.matchDispute.findFirst.mockResolvedValue(null);
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchDispute.create.mockResolvedValue(createdDispute);
                    prismaService.client.match.update.mockResolvedValue({ ...match, status: MatchStatus.DISPUTED });
                    return fn(prismaService.client);
                },
            );

            const result = await service.createDispute(projectId, matchId, minimalDto);

            expect(prismaService.client.matchDispute.create).toHaveBeenCalledWith({
                data: {
                    projectId,
                    matchId,
                    claimantTeamId: null,
                    reason: "Server crash during match",
                    evidence: undefined,
                    status: DisputeStatus.OPEN,
                },
            });
            expect(result).toEqual(createdDispute);
        });
    });

    describe("findAll", () => {
        const projectId = "project_1";

        it("returns paginated disputes for a project with status filter", async () => {
            const query: ListDisputesQueryDto = {
                status: DisputeStatus.OPEN,
                limit: 10,
                offset: 0,
            };

            const mockDisputes = [
                {
                    id: "dispute_1",
                    projectId,
                    matchId: "match_1",
                    status: DisputeStatus.OPEN,
                    reason: "Cheating",
                },
            ];

            prismaService.client.matchDispute.findMany.mockResolvedValue(mockDisputes);
            prismaService.client.matchDispute.count.mockResolvedValue(1);

            const result = await service.findAll(projectId, query);

            expect(prismaService.client.matchDispute.findMany).toHaveBeenCalledWith({
                where: { projectId, status: DisputeStatus.OPEN },
                orderBy: { createdAt: "desc" },
                take: 10,
                skip: 0,
                include: {
                    match: {
                        select: {
                            id: true,
                            gameModeId: true,
                            environment: true,
                            regionKey: true,
                            status: true,
                            createdAt: true,
                        },
                    },
                    resolvedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            expect(prismaService.client.matchDispute.count).toHaveBeenCalledWith({
                where: { projectId, status: DisputeStatus.OPEN },
            });
            expect(result).toEqual({ data: mockDisputes, total: 1 });
        });

        it("uses default limit 50 and offset 0 when query parameters are omitted", async () => {
            prismaService.client.matchDispute.findMany.mockResolvedValue([]);
            prismaService.client.matchDispute.count.mockResolvedValue(0);

            const result = await service.findAll(projectId, {});

            expect(prismaService.client.matchDispute.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { projectId },
                    take: 50,
                    skip: 0,
                }),
            );
            expect(result).toEqual({ data: [], total: 0 });
        });
    });

    describe("findOne", () => {
        const projectId = "project_1";
        const disputeId = "dispute_1";

        it("returns the dispute with match slots, result, gameMode, and resolvedByUser", async () => {
            const mockDispute = {
                id: disputeId,
                projectId,
                matchId: "match_1",
                status: DisputeStatus.OPEN,
                reason: "Suspected map hacking",
                match: {
                    id: "match_1",
                    slots: [{ id: "slot_1", groupIndex: 1, teamSnapshot: [{ playerId: "p1" }] }],
                    result: { id: "res_1", winnerGroupIndex: 1 },
                },
            };

            prismaService.client.matchDispute.findFirst.mockResolvedValue(mockDispute);

            const result = await service.findOne(projectId, disputeId);

            expect(prismaService.client.matchDispute.findFirst).toHaveBeenCalledWith({
                where: { id: disputeId, projectId },
                include: {
                    match: {
                        include: {
                            slots: true,
                            result: true,
                            gameMode: true,
                        },
                    },
                    resolvedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });
            expect(result).toEqual(mockDispute);
        });

        it("throws NotFoundException when dispute is not found", async () => {
            prismaService.client.matchDispute.findFirst.mockResolvedValue(null);

            await expect(service.findOne(projectId, "non_existent")).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe("resolveDispute", () => {
        const projectId = "project_1";
        const disputeId = "dispute_1";
        const context = { authUserId: "user_operator_1", isSuperAdmin: false };
        const resolveDto: ResolveDisputeDto = {
            overrideWinnerGroupIndex: 2,
            resolutionNotes: "Confirmed after video review that team 2 won",
        };

        it("resolves dispute with winner override, updates match/result, reconciles ratings, and emits webhooks", async () => {
            const existingDispute = {
                id: disputeId,
                projectId,
                matchId: "match_1",
                status: DisputeStatus.OPEN,
                match: {
                    id: "match_1",
                    gameModeId: "mode_1",
                    ratingMode: RatingMode.INTERNAL_ELO,
                    status: MatchStatus.DISPUTED,
                    slots: [
                        { groupIndex: 1, teamSnapshot: [{ playerId: "p1", rating: 1200 }] },
                        { groupIndex: 2, teamSnapshot: [{ playerId: "p2", rating: 1200 }] },
                    ],
                    result: {
                        id: "res_1",
                        winnerGroupIndex: 1,
                    },
                },
            };

            const updatedDispute = {
                ...existingDispute,
                status: DisputeStatus.RESOLVED,
                overrideWinnerGroupIndex: 2,
                resolvedByUserId: "user_operator_1",
                resolvedAt: new Date("2026-08-25T13:00:00.000Z"),
                resolutionNotes: resolveDto.resolutionNotes,
            };

            prismaService.client.matchDispute.findFirst.mockResolvedValue(existingDispute);
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchDispute.update.mockResolvedValue(updatedDispute);
                    prismaService.client.match.update.mockResolvedValue({
                        id: "match_1",
                        status: MatchStatus.COMPLETED,
                    });
                    prismaService.client.matchResult.update.mockResolvedValue({ id: "res_1", winnerGroupIndex: 2 });
                    return fn(prismaService.client);
                },
            );

            ratingsService.reconcileEloForDispute.mockResolvedValue([
                { playerId: "p2", ratingBefore: 1200, ratingAfter: 1216, delta: 16 },
                { playerId: "p1", ratingBefore: 1200, ratingAfter: 1184, delta: -16 },
            ]);

            const result = await service.resolveDispute(context, projectId, disputeId, resolveDto);

            expect(prismaService.client.matchDispute.update).toHaveBeenCalledWith({
                where: { id: disputeId },
                data: {
                    status: DisputeStatus.RESOLVED,
                    overrideWinnerGroupIndex: 2,
                    resolvedByUserId: "user_operator_1",
                    resolvedAt: expect.any(Date),
                    resolutionNotes: resolveDto.resolutionNotes,
                },
            });
            expect(prismaService.client.match.update).toHaveBeenCalledWith({
                where: { id: "match_1" },
                data: { status: MatchStatus.COMPLETED },
            });
            expect(prismaService.client.matchResult.update).toHaveBeenCalledWith({
                where: { matchId: "match_1" },
                data: { winnerGroupIndex: 2 },
            });
            expect(ratingsService.reconcileEloForDispute).toHaveBeenCalledWith(
                projectId,
                "mode_1",
                "match_1",
                ["p2"],
                ["p1"],
            );
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                projectId,
                "match.dispute_resolved",
                expect.objectContaining({
                    event: "match.dispute_resolved",
                    matchId: "match_1",
                    disputeId,
                    status: DisputeStatus.RESOLVED,
                    overrideWinnerGroupIndex: 2,
                    resolvedByUserId: "user_operator_1",
                }),
            );
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                projectId,
                "rating.updated",
                expect.objectContaining({
                    event: "rating.updated",
                    matchId: "match_1",
                    gameModeId: "mode_1",
                    updates: [
                        { playerId: "p2", ratingBefore: 1200, ratingAfter: 1216, delta: 16 },
                        { playerId: "p1", ratingBefore: 1200, ratingAfter: 1184, delta: -16 },
                    ],
                }),
            );
            expect(result).toEqual(updatedDispute);
        });

        it("resolves dispute voiding match result (draw/void) and reconciles Elo ratings with empty winners", async () => {
            const existingDispute = {
                id: disputeId,
                projectId,
                matchId: "match_1",
                status: DisputeStatus.OPEN,
                match: {
                    id: "match_1",
                    gameModeId: "mode_1",
                    ratingMode: RatingMode.INTERNAL_ELO,
                    status: MatchStatus.DISPUTED,
                    slots: [
                        { groupIndex: 1, teamSnapshot: [{ playerId: "p1" }] },
                        { groupIndex: 2, teamSnapshot: [{ playerId: "p2" }] },
                    ],
                    result: { id: "res_1", winnerGroupIndex: 1 },
                },
            };

            const updatedDispute = {
                ...existingDispute,
                status: DisputeStatus.RESOLVED,
                overrideWinnerGroupIndex: null,
                resolvedByUserId: "user_operator_1",
                resolvedAt: new Date(),
                resolutionNotes: "Declared void match due to game glitch",
            };

            prismaService.client.matchDispute.findFirst.mockResolvedValue(existingDispute);
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchDispute.update.mockResolvedValue(updatedDispute);
                    prismaService.client.match.update.mockResolvedValue({
                        id: "match_1",
                        status: MatchStatus.COMPLETED,
                    });
                    prismaService.client.matchResult.update.mockResolvedValue({ id: "res_1", winnerGroupIndex: null });
                    return fn(prismaService.client);
                },
            );

            ratingsService.reconcileEloForDispute.mockResolvedValue([]);

            await service.resolveDispute(context, projectId, disputeId, {
                resolutionNotes: "Declared void match due to game glitch",
            });

            expect(ratingsService.reconcileEloForDispute).toHaveBeenCalledWith(projectId, "mode_1", "match_1", [], []);
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                projectId,
                "match.dispute_resolved",
                expect.objectContaining({
                    event: "match.dispute_resolved",
                    matchId: "match_1",
                    disputeId,
                    status: DisputeStatus.RESOLVED,
                    overrideWinnerGroupIndex: null,
                }),
            );
        });

        it("throws NotFoundException when dispute does not exist", async () => {
            prismaService.client.matchDispute.findFirst.mockResolvedValue(null);

            await expect(service.resolveDispute(context, projectId, "non_existent", resolveDto)).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });

        it("throws BadRequestException when dispute is not in OPEN status", async () => {
            prismaService.client.matchDispute.findFirst.mockResolvedValue({
                id: disputeId,
                projectId,
                status: DisputeStatus.RESOLVED,
            });

            await expect(service.resolveDispute(context, projectId, disputeId, resolveDto)).rejects.toBeInstanceOf(
                BadRequestException,
            );
        });
    });

    describe("rejectDispute", () => {
        const projectId = "project_1";
        const disputeId = "dispute_1";
        const context = { authUserId: "user_operator_1", isSuperAdmin: false };
        const rejectDto: RejectDisputeDto = {
            resolutionNotes: "No evidence found to support cheating claim.",
        };

        it("rejects dispute, restores match status, and emits match.dispute_resolved webhook", async () => {
            const existingDispute = {
                id: disputeId,
                projectId,
                matchId: "match_1",
                status: DisputeStatus.OPEN,
                match: {
                    id: "match_1",
                    status: MatchStatus.DISPUTED,
                    result: { id: "res_1", winnerGroupIndex: 1 },
                },
            };

            const updatedDispute = {
                ...existingDispute,
                status: DisputeStatus.REJECTED,
                overrideWinnerGroupIndex: null,
                resolvedByUserId: "user_operator_1",
                resolvedAt: new Date("2026-08-25T13:00:00.000Z"),
                resolutionNotes: rejectDto.resolutionNotes,
            };

            prismaService.client.matchDispute.findFirst.mockResolvedValue(existingDispute);
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.matchDispute.update.mockResolvedValue(updatedDispute);
                    prismaService.client.match.update.mockResolvedValue({
                        id: "match_1",
                        status: MatchStatus.COMPLETED,
                    });
                    return fn(prismaService.client);
                },
            );

            const result = await service.rejectDispute(context, projectId, disputeId, rejectDto);

            expect(prismaService.client.matchDispute.update).toHaveBeenCalledWith({
                where: { id: disputeId },
                data: {
                    status: DisputeStatus.REJECTED,
                    resolvedByUserId: "user_operator_1",
                    resolvedAt: expect.any(Date),
                    resolutionNotes: rejectDto.resolutionNotes,
                },
            });
            expect(prismaService.client.match.update).toHaveBeenCalledWith({
                where: { id: "match_1" },
                data: { status: MatchStatus.COMPLETED },
            });
            expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
                projectId,
                "match.dispute_resolved",
                expect.objectContaining({
                    event: "match.dispute_resolved",
                    matchId: "match_1",
                    disputeId,
                    status: DisputeStatus.REJECTED,
                    overrideWinnerGroupIndex: null,
                    resolvedByUserId: "user_operator_1",
                    resolutionNotes: rejectDto.resolutionNotes,
                }),
            );
            expect(result).toEqual(updatedDispute);
        });

        it("throws NotFoundException when dispute does not exist", async () => {
            prismaService.client.matchDispute.findFirst.mockResolvedValue(null);

            await expect(service.rejectDispute(context, projectId, "non_existent", rejectDto)).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });

        it("throws BadRequestException when dispute is not in OPEN status", async () => {
            prismaService.client.matchDispute.findFirst.mockResolvedValue({
                id: disputeId,
                projectId,
                status: DisputeStatus.REJECTED,
            });

            await expect(service.rejectDispute(context, projectId, disputeId, rejectDto)).rejects.toBeInstanceOf(
                BadRequestException,
            );
        });
    });
});
