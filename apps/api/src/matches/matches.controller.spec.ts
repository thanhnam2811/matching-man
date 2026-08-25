import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { DisputesService } from "../disputes/disputes.service";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ReportResultDto } from "./dto/report-result.dto";
import { CreateMatchDisputeDto } from "../disputes/dto/create-match-dispute.dto";

describe("MatchesController", () => {
    let controller: MatchesController;
    let matchesService: {
        findOne: jest.Mock;
        reportResult: jest.Mock;
    };
    let disputesService: {
        createDispute: jest.Mock;
    };

    const mockRequest = {
        authProjectId: "project_1",
        authApiKeyId: "key_1",
    } as AuthenticatedProjectRequest;

    beforeEach(() => {
        matchesService = {
            findOne: jest.fn(),
            reportResult: jest.fn(),
        };
        disputesService = {
            createDispute: jest.fn(),
        };

        controller = new MatchesController(
            matchesService as unknown as MatchesService,
            disputesService as unknown as DisputesService,
        );
    });

    describe("findOne", () => {
        it("delegates to matchesService.findOne", async () => {
            const expected = { id: "match_1", status: "created" };
            matchesService.findOne.mockResolvedValue(expected);

            const result = await controller.findOne(mockRequest, "match_1");

            expect(matchesService.findOne).toHaveBeenCalledWith("project_1", "match_1");
            expect(result).toEqual(expected);
        });
    });

    describe("reportResult", () => {
        it("delegates to matchesService.reportResult", async () => {
            const dto: ReportResultDto = {
                endedAt: "2026-08-25T12:00:00.000Z",
                winnerGroupIndex: 1,
            };
            const expected = { matchId: "match_1", status: "completed" };
            matchesService.reportResult.mockResolvedValue(expected);

            const result = await controller.reportResult(mockRequest, "match_1", dto);

            expect(matchesService.reportResult).toHaveBeenCalledWith("project_1", "match_1", dto);
            expect(result).toEqual(expected);
        });
    });

    describe("createDispute", () => {
        it("delegates to disputesService.createDispute", async () => {
            const dto: CreateMatchDisputeDto = {
                claimantTeamId: "team_1",
                reason: "Cheating suspected",
                evidence: { round: 3 },
            };
            const expected = { id: "dispute_1", status: "OPEN" };
            disputesService.createDispute.mockResolvedValue(expected);

            const result = await controller.createDispute(mockRequest, "match_1", dto);

            expect(disputesService.createDispute).toHaveBeenCalledWith("project_1", "match_1", dto);
            expect(result).toEqual(expected);
        });
    });
});
