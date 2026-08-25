import { ConflictException, NotFoundException } from "@nestjs/common";
import { DisputeStatus, MatchStatus } from "../generated/prisma/enums";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import { DisputesService } from "./disputes.service";
import { CreateMatchDisputeDto } from "./dto/create-match-dispute.dto";

describe("DisputesService", () => {
    let service: DisputesService;
    let prismaService: {
        client: {
            match: { findFirst: jest.Mock; update: jest.Mock };
            matchDispute: { create: jest.Mock; findFirst: jest.Mock };
            $transaction: jest.Mock;
        };
    };
    let webhookDeliveryService: { scheduleDelivery: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                match: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
                matchDispute: {
                    create: jest.fn(),
                    findFirst: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };

        webhookDeliveryService = { scheduleDelivery: jest.fn() };

        service = new DisputesService(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
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
});
