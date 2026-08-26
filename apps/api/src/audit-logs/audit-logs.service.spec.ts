import { AuditLogService } from "./audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditAction, AuditResourceType } from "../generated/prisma/client";

describe("AuditLogService", () => {
    let service: AuditLogService;
    let prismaService: {
        client: {
            auditLog: {
                create: jest.Mock;
                findMany: jest.Mock;
                count: jest.Mock;
            };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                auditLog: {
                    create: jest.fn().mockResolvedValue({ id: "audit_1" }),
                    findMany: jest.fn().mockResolvedValue([]),
                    count: jest.fn().mockResolvedValue(0),
                },
            },
        };

        service = new AuditLogService(prismaService as unknown as PrismaService);
    });

    describe("recordLog", () => {
        it("redacts sensitive fields like passwords, tokens, and secrets", async () => {
            await service.recordLog({
                organizationId: "org_1",
                projectId: "proj_1",
                actorUserId: "user_1",
                action: AuditAction.API_KEY_CREATED,
                targetResourceType: AuditResourceType.API_KEY,
                targetResourceId: "key_1",
                metadataBefore: { passwordHash: "secret123", apiKey: "mm_live_xyz", normalField: "ok" },
                metadataAfter: { secretToken: "tok456", title: "Production Key" },
            });

            expect(prismaService.client.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: AuditAction.API_KEY_CREATED,
                    targetResourceType: AuditResourceType.API_KEY,
                    metadataBefore: {
                        passwordHash: "[REDACTED]",
                        apiKey: "[REDACTED]",
                        normalField: "ok",
                    },
                    metadataAfter: {
                        secretToken: "[REDACTED]",
                        title: "Production Key",
                    },
                }),
            });
        });

        it("never throws if database fails (non-blocking)", async () => {
            prismaService.client.auditLog.create.mockRejectedValue(new Error("DB Connection Failed"));

            await expect(
                service.recordLog({
                    organizationId: "org_1",
                    action: AuditAction.WEBHOOK_CREATED,
                    targetResourceType: AuditResourceType.WEBHOOK_ENDPOINT,
                    targetResourceId: "ep_1",
                }),
            ).resolves.not.toThrow();
        });
    });

    describe("findProjectLogs", () => {
        it("queries logs with pagination and filters", async () => {
            prismaService.client.auditLog.findMany.mockResolvedValue([{ id: "log_1" }]);
            prismaService.client.auditLog.count.mockResolvedValue(1);

            const result = await service.findProjectLogs("proj_1", {
                page: 1,
                limit: 10,
                action: AuditAction.API_KEY_CREATED,
            });

            expect(result.items).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(result.pagination.totalPages).toBe(1);
        });
    });
});
