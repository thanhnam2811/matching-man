import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DisputeStatus, MatchStatus, Prisma } from "../generated/prisma/client";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateMatchDisputeDto } from "./dto/create-match-dispute.dto";

@Injectable()
export class DisputesService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly webhookDeliveryService: WebhookDeliveryService,
    ) {}

    async createDispute(projectId: string, matchId: string, dto: CreateMatchDisputeDto) {
        const match = await this.prismaService.client.match.findFirst({
            where: { id: matchId, projectId },
        });

        if (!match) {
            throw new NotFoundException("Match not found");
        }

        const existingDispute = await this.prismaService.client.matchDispute.findFirst({
            where: {
                matchId,
                projectId,
                status: DisputeStatus.OPEN,
            },
        });

        if (existingDispute) {
            throw new ConflictException("An open dispute already exists for this match");
        }

        const dispute = await this.prismaService.client.$transaction(async (tx) => {
            const created = await tx.matchDispute.create({
                data: {
                    projectId,
                    matchId,
                    claimantTeamId: dto.claimantTeamId ?? null,
                    reason: dto.reason,
                    evidence: dto.evidence ? (dto.evidence as Prisma.InputJsonValue) : undefined,
                    status: DisputeStatus.OPEN,
                },
            });

            await tx.match.update({
                where: { id: matchId },
                data: { status: MatchStatus.DISPUTED },
            });

            return created;
        });

        await this.webhookDeliveryService.scheduleDelivery(projectId, "match.disputed", {
            event: "match.disputed",
            matchId,
            disputeId: dispute.id,
            claimantTeamId: dispute.claimantTeamId,
            reason: dispute.reason,
            createdAt: dispute.createdAt,
        });

        return dispute;
    }
}
