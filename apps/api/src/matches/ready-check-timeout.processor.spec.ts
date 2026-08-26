import { PenaltyReason, SlotAcceptStatus, MatchStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WebhookDeliveryService } from "../deliveries/deliveries.service";
import { PenaltiesService } from "../penalties/penalties.service";
import { QueuesService } from "../queues/queues.service";
import { ReadyCheckTimeoutProcessor } from "./ready-check-timeout.processor";

describe("ReadyCheckTimeoutProcessor", () => {
    let processor: ReadyCheckTimeoutProcessor;
    let prismaService: {
        client: {
            match: { findFirst: jest.Mock; update: jest.Mock };
            matchSlot: { update: jest.Mock };
            queueEntry: { update: jest.Mock };
        };
    };
    let webhookDeliveryService: { scheduleDelivery: jest.Mock };
    let penaltiesService: { recordPenalty: jest.Mock };
    let queuesService: { requeueInnocentEntries: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                match: { findFirst: jest.fn(), update: jest.fn() },
                matchSlot: { update: jest.fn() },
                queueEntry: { update: jest.fn() },
            },
        };
        webhookDeliveryService = { scheduleDelivery: jest.fn() };
        penaltiesService = { recordPenalty: jest.fn() };
        queuesService = { requeueInnocentEntries: jest.fn() };

        processor = new ReadyCheckTimeoutProcessor(
            prismaService as unknown as PrismaService,
            webhookDeliveryService as unknown as WebhookDeliveryService,
            penaltiesService as unknown as PenaltiesService,
            queuesService as unknown as QueuesService,
        );
    });

    it("cancels match, marks AFK slots TIMED_OUT, penalizes AFK players, and requeues accepted slots", async () => {
        prismaService.client.match.findFirst.mockResolvedValue({
            id: "match_1",
            projectId: "proj_1",
            matchPoolId: "pool_1",
            gameModeId: "gm_1",
            environment: "production",
            regionKey: "global",
            status: MatchStatus.PENDING_ACCEPTANCE,
            slots: [
                {
                    id: "slot_1",
                    queueEntryId: "entry_1",
                    acceptStatus: SlotAcceptStatus.ACCEPTED,
                    acceptedPlayerIds: ["p1"],
                    teamSnapshot: [{ playerId: "p1" }],
                },
                {
                    id: "slot_2",
                    queueEntryId: "entry_2",
                    acceptStatus: SlotAcceptStatus.PENDING,
                    acceptedPlayerIds: [],
                    teamSnapshot: [{ playerId: "p2" }],
                },
            ],
        });

        await processor.process({ data: { matchId: "match_1", projectId: "proj_1" } } as any);

        expect(prismaService.client.match.update).toHaveBeenCalledWith({
            where: { id: "match_1" },
            data: { status: MatchStatus.CANCELLED },
        });

        expect(prismaService.client.matchSlot.update).toHaveBeenCalledWith({
            where: { id: "slot_2" },
            data: { acceptStatus: SlotAcceptStatus.TIMED_OUT },
        });

        expect(penaltiesService.recordPenalty).toHaveBeenCalledWith({
            projectId: "proj_1",
            playerId: "p2",
            reason: PenaltyReason.AFK_TIMEOUT,
        });

        expect(queuesService.requeueInnocentEntries).toHaveBeenCalledWith("proj_1", ["entry_1"], "pool_1");

        expect(webhookDeliveryService.scheduleDelivery).toHaveBeenCalledWith(
            "proj_1",
            "match.ready_check_expired",
            expect.objectContaining({ matchId: "match_1" }),
        );
    });
});
