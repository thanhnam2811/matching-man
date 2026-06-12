import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MatchesService } from "./matches.service";

describe("MatchesService", () => {
    let service: MatchesService;
    let prismaService: {
        client: {
            match: {
                findFirst: jest.Mock;
            };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                match: {
                    findFirst: jest.fn(),
                },
            },
        };

        service = new MatchesService(prismaService as unknown as PrismaService);
    });

    it("reads team members from immutable slot snapshots", async () => {
        prismaService.client.match.findFirst.mockResolvedValue({
            id: "match_1",
            projectId: "project_1",
            gameModeId: "mode_1",
            status: "CREATED",
            environment: "production",
            regionKey: "global",
            requiredSlots: 2,
            groupCount: 2,
            createdAt: new Date("2026-06-12T00:00:00.000Z"),
            slots: [
                {
                    slotIndex: 1,
                    groupIndex: 1,
                    teamId: "team_1",
                    teamSnapshot: [{ playerId: "player_1", rating: 1010 }],
                },
            ],
        });

        const match = await service.findOne("project_1", "match_1");

        expect(match.slots[0].members).toEqual([{ playerId: "player_1", rating: 1010 }]);
    });

    it("throws when the match does not exist", async () => {
        prismaService.client.match.findFirst.mockResolvedValue(null);

        await expect(service.findOne("project_1", "missing")).rejects.toBeInstanceOf(NotFoundException);
    });
});