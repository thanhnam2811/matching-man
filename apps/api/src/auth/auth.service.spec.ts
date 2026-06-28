import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SessionTokenService } from "./session-token.service";

describe("AuthService", () => {
    let service: AuthService;
    let prismaService: {
        client: {
            user: { findUnique: jest.Mock; create: jest.Mock };
            organization: { findUnique: jest.Mock; create: jest.Mock };
            organizationMember: { create: jest.Mock };
            $transaction: jest.Mock;
        };
    };
    let passwordService: { hash: jest.Mock; verify: jest.Mock };
    let sessionTokenService: { sign: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                user: { findUnique: jest.fn(), create: jest.fn() },
                organization: { findUnique: jest.fn(), create: jest.fn() },
                organizationMember: { create: jest.fn() },
                $transaction: jest.fn(),
            },
        };
        passwordService = { hash: jest.fn(), verify: jest.fn() };
        sessionTokenService = {
            sign: jest.fn().mockReturnValue({ token: "tok", expiresAt: new Date(Date.now() + 1000) }),
        };

        service = new AuthService(
            { get: jest.fn() } as unknown as ConfigService,
            prismaService as unknown as PrismaService,
            passwordService as unknown as PasswordService,
            sessionTokenService as unknown as SessionTokenService,
        );
    });

    describe("register", () => {
        it("rejects an already-registered email", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_1" });

            await expect(service.register({ email: "a@b.com", password: "password123" })).rejects.toBeInstanceOf(
                ConflictException,
            );
        });

        it("creates a user, seeds a personal org, and issues a session", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);
            passwordService.hash.mockResolvedValue("hashed");
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.user.create.mockResolvedValue({
                        id: "user_1",
                        email: "a@b.com",
                        name: null,
                    });
                    prismaService.client.organization.findUnique.mockResolvedValue(null);
                    prismaService.client.organization.create.mockResolvedValue({ id: "org_1" });
                    prismaService.client.organizationMember.create.mockResolvedValue({ id: "member_1" });
                    return fn(prismaService.client);
                },
            );

            const result = await service.register({ email: "A@B.com", password: "password123" });

            expect(passwordService.hash).toHaveBeenCalledWith("password123");
            expect(prismaService.client.organizationMember.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ role: "OWNER" }) }),
            );
            expect(result.token).toBe("tok");
            expect(result.user).toEqual({ id: "user_1", email: "a@b.com", name: null });
        });
    });

    describe("login", () => {
        it("rejects unknown email", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);

            await expect(service.login({ email: "a@b.com", password: "x" })).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
        });

        it("rejects a wrong password", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_1", passwordHash: "hashed" });
            passwordService.verify.mockResolvedValue(false);

            await expect(service.login({ email: "a@b.com", password: "x" })).rejects.toBeInstanceOf(
                UnauthorizedException,
            );
        });

        it("issues a session on valid credentials", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({
                id: "user_1",
                email: "a@b.com",
                name: "A",
                passwordHash: "hashed",
            });
            passwordService.verify.mockResolvedValue(true);

            const result = await service.login({ email: "a@b.com", password: "right" });

            expect(sessionTokenService.sign).toHaveBeenCalledWith("user_1");
            expect(result.user).toEqual({ id: "user_1", email: "a@b.com", name: "A" });
        });
    });
});
