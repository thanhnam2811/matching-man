import { Test, TestingModule } from "@nestjs/testing";
import { DisputeStatus } from "../generated/prisma/enums";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";
import { ListDisputesQueryDto } from "./dto/list-disputes-query.dto";
import { RejectDisputeDto } from "./dto/reject-dispute.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { PrismaService } from "../prisma/prisma.service";

describe("DisputesController", () => {
    let controller: DisputesController;
    let disputesService: {
        findAll: jest.Mock;
        findOne: jest.Mock;
        resolveDispute: jest.Mock;
        rejectDispute: jest.Mock;
    };

    beforeEach(async () => {
        disputesService = {
            findAll: jest.fn(),
            findOne: jest.fn(),
            resolveDispute: jest.fn(),
            rejectDispute: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [DisputesController],
            providers: [
                { provide: DisputesService, useValue: disputesService },
                { provide: PrismaService, useValue: {} },
            ],
        })
            .overrideGuard(DashboardAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(ProjectAccessGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<DisputesController>(DisputesController);
    });

    it("delegates findAll to DisputesService", async () => {
        const query: ListDisputesQueryDto = { status: DisputeStatus.OPEN, limit: 10, offset: 0 };
        const expected = { data: [], total: 0 };
        disputesService.findAll.mockResolvedValue(expected);

        const result = await controller.findAll("project_1", query);

        expect(disputesService.findAll).toHaveBeenCalledWith("project_1", query);
        expect(result).toEqual(expected);
    });

    it("delegates findOne to DisputesService", async () => {
        const expected = { id: "dispute_1", projectId: "project_1" };
        disputesService.findOne.mockResolvedValue(expected);

        const result = await controller.findOne("project_1", "dispute_1");

        expect(disputesService.findOne).toHaveBeenCalledWith("project_1", "dispute_1");
        expect(result).toEqual(expected);
    });

    it("delegates resolve to DisputesService with dashboard context", async () => {
        const req = { authUserId: "user_1", isSuperAdmin: false } as any;
        const dto: ResolveDisputeDto = {
            overrideWinnerGroupIndex: 2,
            resolutionNotes: "Resolved after review",
        };
        const expected = { id: "dispute_1", status: DisputeStatus.RESOLVED };
        disputesService.resolveDispute.mockResolvedValue(expected);

        const result = await controller.resolve(req, "project_1", "dispute_1", dto);

        expect(disputesService.resolveDispute).toHaveBeenCalledWith(
            { authUserId: "user_1", isSuperAdmin: false },
            "project_1",
            "dispute_1",
            dto,
        );
        expect(result).toEqual(expected);
    });

    it("delegates reject to DisputesService with dashboard context", async () => {
        const req = { authUserId: "user_1", isSuperAdmin: false } as any;
        const dto: RejectDisputeDto = {
            resolutionNotes: "Rejected due to insufficient evidence",
        };
        const expected = { id: "dispute_1", status: DisputeStatus.REJECTED };
        disputesService.rejectDispute.mockResolvedValue(expected);

        const result = await controller.reject(req, "project_1", "dispute_1", dto);

        expect(disputesService.rejectDispute).toHaveBeenCalledWith(
            { authUserId: "user_1", isSuperAdmin: false },
            "project_1",
            "dispute_1",
            dto,
        );
        expect(result).toEqual(expected);
    });
});
