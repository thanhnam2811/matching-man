import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { DemoService } from "../demo/demo.service";
import { EmailService } from "../email/email.service";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SessionTokenService } from "./session-token.service";
import { hashToken } from "../common/utils/hash-token.util";

describe("AuthService", () => {
    let service: AuthService;
    let prismaService: {
        client: {
            user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
            organization: { findUnique: jest.Mock; create: jest.Mock };
            organizationMember: { create: jest.Mock };
            subscription: { create: jest.Mock };
            passwordResetToken: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
            emailVerificationToken: {
                findUnique: jest.Mock;
                create: jest.Mock;
                update: jest.Mock;
                updateMany: jest.Mock;
            };
            $transaction: jest.Mock;
        };
    };
    let passwordService: { hash: jest.Mock; verify: jest.Mock };
    let sessionTokenService: { sign: jest.Mock };
    let emailService: { sendPasswordResetEmail: jest.Mock; sendEmailVerification: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
                organization: { findUnique: jest.fn(), create: jest.fn() },
                organizationMember: { create: jest.fn() },
                subscription: { create: jest.fn() },
                passwordResetToken: {
                    findUnique: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    updateMany: jest.fn(),
                },
                emailVerificationToken: {
                    findUnique: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    updateMany: jest.fn(),
                },
                $transaction: jest.fn(),
            },
        };
        passwordService = { hash: jest.fn(), verify: jest.fn() };
        sessionTokenService = {
            sign: jest.fn().mockReturnValue({ token: "tok", expiresAt: new Date(Date.now() + 1000) }),
        };
        emailService = {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendEmailVerification: jest.fn().mockResolvedValue(undefined),
        };

        const demoService = {
            getStatusForEmail: jest.fn().mockResolvedValue({
                isDemoAccount: false,
                resetIntervalMinutes: 60,
                lastResetAt: null,
                nextResetAt: null,
            }),
        };

        service = new AuthService(
            { get: jest.fn() } as unknown as ConfigService,
            prismaService as unknown as PrismaService,
            passwordService as unknown as PasswordService,
            sessionTokenService as unknown as SessionTokenService,
            demoService as unknown as DemoService,
            emailService as unknown as EmailService,
        );
    });

    describe("register", () => {
        it("rejects an already-registered email", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({ id: "user_1" });

            await expect(service.register({ email: "a@b.com", password: "password123" })).rejects.toBeInstanceOf(
                ConflictException,
            );
        });

        it("creates a user, seeds a personal org and free subscription, and issues a session", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);
            passwordService.hash.mockResolvedValue("hashed");
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    prismaService.client.user.create.mockResolvedValue({
                        id: "user_1",
                        email: "a@b.com",
                        name: null,
                        emailVerified: false,
                        tokenVersion: 0,
                    });
                    prismaService.client.organization.findUnique.mockResolvedValue(null);
                    prismaService.client.organization.create.mockResolvedValue({ id: "org_1" });
                    prismaService.client.organizationMember.create.mockResolvedValue({ id: "member_1" });
                    prismaService.client.subscription.create.mockResolvedValue({ id: "sub_1" });
                    return fn(prismaService.client);
                },
            );

            const result = await service.register({ email: "A@B.com", password: "password123" });

            expect(passwordService.hash).toHaveBeenCalledWith("password123");
            expect(prismaService.client.organizationMember.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ role: "OWNER" }) }),
            );
            expect(prismaService.client.subscription.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ planTier: "FREE" }) }),
            );
            expect(result.token).toBe("tok");
            expect(result.user).toEqual({ id: "user_1", email: "a@b.com", name: null, emailVerified: false });
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
                emailVerified: true,
                tokenVersion: 2,
            });
            passwordService.verify.mockResolvedValue(true);

            const result = await service.login({ email: "a@b.com", password: "right" });

            expect(sessionTokenService.sign).toHaveBeenCalledWith("user_1", 2);
            expect(result.user).toEqual({ id: "user_1", email: "a@b.com", name: "A", emailVerified: true });
        });
    });

    describe("forgotPassword", () => {
        it("creates a reset token and sends email when user exists", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({
                id: "user_1",
                email: "operator@example.com",
            });
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    return fn(prismaService.client);
                },
            );

            const result = await service.forgotPassword({ email: "operator@example.com" });

            expect(result.message).toContain("If an account exists");
            expect(prismaService.client.passwordResetToken.create).toHaveBeenCalled();
            expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
                "operator@example.com",
                expect.any(String),
            );
        });

        it("returns generic message without error when user does not exist (enumeration safe)", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);

            const result = await service.forgotPassword({ email: "nonexistent@example.com" });

            expect(result.message).toContain("If an account exists");
            expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
        });
    });

    describe("resetPassword", () => {
        it("resets password and increments tokenVersion for valid token", async () => {
            const rawToken = "a".repeat(64);
            const tokenHash = hashToken(rawToken);

            prismaService.client.passwordResetToken.findUnique.mockResolvedValue({
                id: "token_1",
                userId: "user_1",
                tokenHash,
                expiresAt: new Date(Date.now() + 60000),
                usedAt: null,
            });

            passwordService.hash.mockResolvedValue("new_hashed_password");
            prismaService.client.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
            prismaService.client.user.update.mockResolvedValue({ id: "user_1" });
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    return fn(prismaService.client);
                },
            );

            const result = await service.resetPassword({
                token: rawToken,
                newPassword: "BrandNewPassword123!",
            });

            expect(result.message).toContain("Password has been reset successfully");
            expect(prismaService.client.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "user_1" },
                    data: expect.objectContaining({
                        passwordHash: "new_hashed_password",
                        tokenVersion: { increment: 1 },
                    }),
                }),
            );
        });

        it("rejects expired or used token", async () => {
            prismaService.client.passwordResetToken.findUnique.mockResolvedValue({
                id: "token_1",
                userId: "user_1",
                tokenHash: "abc",
                expiresAt: new Date(Date.now() - 60000), // Expired
                usedAt: null,
            });

            await expect(
                service.resetPassword({
                    token: "a".repeat(64),
                    newPassword: "BrandNewPassword123!",
                }),
            ).rejects.toBeInstanceOf(BadRequestException);
        });
    });

    describe("verifyEmail", () => {
        it("verifies email successfully for valid token", async () => {
            const rawToken = "b".repeat(64);
            const tokenHash = hashToken(rawToken);

            prismaService.client.emailVerificationToken.findUnique.mockResolvedValue({
                id: "verify_1",
                userId: "user_1",
                tokenHash,
                expiresAt: new Date(Date.now() + 60000),
                usedAt: null,
            });

            prismaService.client.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
            prismaService.client.user.update.mockResolvedValue({ id: "user_1" });
            prismaService.client.$transaction.mockImplementation(
                async (fn: (tx: typeof prismaService.client) => unknown) => {
                    return fn(prismaService.client);
                },
            );

            const result = await service.verifyEmail({ token: rawToken });

            expect(result.message).toContain("Email has been verified successfully");
            expect(prismaService.client.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "user_1" },
                    data: { emailVerified: true },
                }),
            );
        });
    });
});
