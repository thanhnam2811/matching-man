import { PenaltyReason, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PenaltiesService } from "./penalties.service";

describe("PenaltiesService", () => {
    let service: PenaltiesService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            playerPenalty: {
                create: jest.Mock;
                findMany: jest.Mock;
                findFirst: jest.Mock;
                update: jest.Mock;
                count: jest.Mock;
            };
            organizationMember: { findUnique: jest.Mock };
        };
    };
    let webhookDeliveryService: { scheduleDelivery: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                project: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: "proj_1",
                        organizationId: "org_1",
                        enableDodgePenalty: true,
                        penaltyTiers: [180, 900, 3600],
                        penaltyDecayHours: 24,
                        members: [{ userId: "admin_1", role: ProjectMemberRole.ADMIN }],
                    }),
                },
                playerPenalty: {
                    create: jest.fn(),
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                    count: jest.fn(),
                },
                organizationMember: { findUnique: jest.fn() },
            },
        };
        webhookDeliveryService = { scheduleDelivery: jest.fn().mockResolvedValue(undefined) };

        service = new PenaltiesService(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
        );
    });

    it("applies first tier penalty (180s) on first violation", async () => {
        prismaService.client.playerPenalty.findMany.mockResolvedValue([]);
        prismaService.client.playerPenalty.create.mockImplementation((args) => ({
            id: "pen_1",
            ...args.data,
        }));

        const result = await service.recordPenalty({
            projectId: "proj_1",
            playerId: "player_123",
            reason: PenaltyReason.DODGE,
        });

        expect(result?.durationSeconds).toBe(180);
        expect(result?.violationCount).toBe(1);
        expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
            "proj_1",
            "player.penalized",
            expect.objectContaining({
                playerId: "player_123",
                durationSeconds: 180,
                violationCount: 1,
            }),
        );
    });

    it("escalates to second tier (900s) on second violation within decay window", async () => {
        prismaService.client.playerPenalty.findMany.mockResolvedValue([{ id: "pen_0", createdAt: new Date() }]);
        prismaService.client.playerPenalty.create.mockImplementation((args) => ({
            id: "pen_2",
            ...args.data,
        }));

        const result = await service.recordPenalty({
            projectId: "proj_1",
            playerId: "player_123",
            reason: PenaltyReason.AFK_TIMEOUT,
        });

        expect(result?.durationSeconds).toBe(900);
        expect(result?.violationCount).toBe(2);
    });

    it("checks active penalties for multiple players", async () => {
        prismaService.client.playerPenalty.findFirst.mockResolvedValue({
            id: "pen_1",
            playerId: "player_blocked",
            expiresAt: new Date(Date.now() + 60000),
            reason: PenaltyReason.DODGE,
        });

        const active = await service.checkActivePenalties("proj_1", ["player_ok", "player_blocked"]);
        expect(active?.playerId).toBe("player_blocked");
    });
});
