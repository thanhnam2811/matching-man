import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import { hashToken } from "../common/utils/hash-token.util";
import { DemoService } from "../demo/demo.service";
import { EmailService } from "../email/email.service";
import { RedisService } from "../common/redis/redis.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import type { ForgotPasswordDto } from "./dto/forgot-password.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";
import type { VerifyEmailDto } from "./dto/verify-email.dto";
import { PasswordService } from "./password.service";
import { SessionTokenService } from "./session-token.service";

type SessionUser = {
    id: string;
    email: string;
    name: string | null;
    passwordHash: string | null;
    emailVerified?: boolean;
    tokenVersion?: number;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
        private readonly passwordService: PasswordService,
        private readonly sessionTokenService: SessionTokenService,
        private readonly demoService: DemoService,
        private readonly emailService: EmailService,
        private readonly redisService?: RedisService,
    ) {}

    getContract() {
        return {
            dashboardAuth: {
                type: "bearer_token",
                status: "active",
            },
            userAuth: {
                type: "session_token",
                status: "active",
            },
            projectApiAuth: {
                type: "bearer_api_key",
                status: "active_design",
            },
        };
    }

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();

        const existing = await this.prismaService.client.user.findUnique({ where: { email } });
        if (existing) {
            throw new ConflictException("Email already registered");
        }

        const passwordHash = await this.passwordService.hash(dto.password);
        const fallbackName = dto.name?.trim() || email.split("@")[0];
        const organizationName = dto.organizationName?.trim() || `${fallbackName}'s organization`;

        const user = await this.prismaService.client.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: { email, name: dto.name?.trim() || null, passwordHash, emailVerified: false, tokenVersion: 0 },
            });

            let slug = normalizeSlug(dto.organizationSlug?.trim() || organizationName);
            const slugTaken = await tx.organization.findUnique({ where: { slug } });
            if (slugTaken) {
                slug = `${slug}-${randomBytes(3).toString("hex")}`;
            }

            const organization = await tx.organization.create({
                data: { name: organizationName, slug, createdById: created.id },
            });

            await tx.organizationMember.create({
                data: { organizationId: organization.id, userId: created.id, role: ProjectMemberRole.OWNER },
            });

            // Automatically create default FREE subscription for new organization
            await tx.subscription.create({
                data: {
                    organizationId: organization.id,
                    stripeCustomerId: `cus_local_${randomBytes(8).toString("hex")}`,
                    planTier: "FREE",
                    status: "ACTIVE",
                },
            });

            return created;
        });

        // Fire-and-forget email verification
        this.sendVerificationEmailForUser(user.id).catch(() => {});

        return this.issueSession(user);
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prismaService.client.user.findUnique({ where: { email } });

        const hashToVerify =
            user?.passwordHash ??
            "00000000000000000000000000000000:00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        const isValid = await this.passwordService.verify(dto.password, hashToVerify);

        if (!user || !user.passwordHash || !isValid) {
            throw new UnauthorizedException("Invalid email or password");
        }

        return this.issueSession(user);
    }

    async me(userId: string) {
        const user = await this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                emailVerified: true,
                tokenVersion: true,
                organizationMemberships: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        role: true,
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                subscription: {
                                    select: {
                                        planTier: true,
                                        status: true,
                                        cancelAtPeriodEnd: true,
                                        currentPeriodEnd: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new UnauthorizedException("User not found");
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            organizations: user.organizationMemberships.map((membership) => ({
                id: membership.organization.id,
                name: membership.organization.name,
                slug: membership.organization.slug,
                role: membership.role,
                subscription: membership.organization.subscription,
            })),
            demo: await this.demoService.getStatusForEmail(user.email),
        };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prismaService.client.user.findUnique({
            where: { email },
            select: { id: true, email: true },
        });

        if (user) {
            const rawToken = randomBytes(32).toString("hex");
            const tokenHash = hashToken(rawToken);
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            await this.prismaService.client.$transaction(async (tx) => {
                // Invalidate prior unused tokens
                await tx.passwordResetToken.updateMany({
                    where: { userId: user.id, usedAt: null },
                    data: { usedAt: new Date() },
                });
                await tx.passwordResetToken.create({
                    data: { userId: user.id, tokenHash, expiresAt },
                });
            });

            // Dispatch reset email asynchronously
            this.emailService.sendPasswordResetEmail(user.email, rawToken).catch(() => {});
        } else {
            // Equalize CPU timing to prevent user enumeration
            const dummyToken = randomBytes(32).toString("hex");
            hashToken(dummyToken);
        }

        return {
            message: "If an account exists with this email address, a password reset link has been sent.",
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const tokenHash = hashToken(dto.token.trim());

        const tokenRecord = await this.prismaService.client.passwordResetToken.findUnique({
            where: { tokenHash },
        });

        if (!tokenRecord || tokenRecord.usedAt !== null || tokenRecord.expiresAt < new Date()) {
            throw new BadRequestException("Invalid or expired password reset token");
        }

        const newPasswordHash = await this.passwordService.hash(dto.newPassword);

        await this.prismaService.client.$transaction(async (tx) => {
            // Atomic check and claim
            const updateResult = await tx.passwordResetToken.updateMany({
                where: { id: tokenRecord.id, usedAt: null },
                data: { usedAt: new Date() },
            });

            if (updateResult.count === 0) {
                throw new BadRequestException("Invalid or expired password reset token");
            }

            await tx.user.update({
                where: { id: tokenRecord.userId },
                data: {
                    passwordHash: newPasswordHash,
                    tokenVersion: { increment: 1 },
                },
            });
        });

        // Invalidate Redis session cache if redis is active
        if (this.redisService?.client) {
            try {
                await this.redisService.client.del(`user:token_version:${tokenRecord.userId}`);
            } catch {
                // Non-critical cache purge failure
            }
        }

        return {
            message: "Password has been reset successfully. Please sign in with your new password.",
        };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        const tokenHash = hashToken(dto.token.trim());

        const tokenRecord = await this.prismaService.client.emailVerificationToken.findUnique({
            where: { tokenHash },
        });

        if (!tokenRecord || tokenRecord.usedAt !== null || tokenRecord.expiresAt < new Date()) {
            throw new BadRequestException("Invalid or expired verification token");
        }

        await this.prismaService.client.$transaction(async (tx) => {
            const updateResult = await tx.emailVerificationToken.updateMany({
                where: { id: tokenRecord.id, usedAt: null },
                data: { usedAt: new Date() },
            });

            if (updateResult.count === 0) {
                throw new BadRequestException("Invalid or expired verification token");
            }

            await tx.user.update({
                where: { id: tokenRecord.userId },
                data: { emailVerified: true },
            });
        });

        return {
            message: "Email has been verified successfully.",
        };
    }

    async sendVerificationEmailForUser(userId: string) {
        const user = await this.prismaService.client.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, emailVerified: true },
        });

        if (!user) {
            throw new BadRequestException("User not found");
        }

        if (user.emailVerified) {
            return { message: "Email is already verified." };
        }

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.prismaService.client.$transaction(async (tx) => {
            await tx.emailVerificationToken.updateMany({
                where: { userId: user.id, usedAt: null },
                data: { usedAt: new Date() },
            });
            await tx.emailVerificationToken.create({
                data: { userId: user.id, tokenHash, expiresAt },
            });
        });

        await this.emailService.sendEmailVerification(user.email, rawToken);

        return { message: "Verification email sent." };
    }

    private issueSession(user: SessionUser) {
        const tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
        const { token, expiresAt } = this.sessionTokenService.sign(user.id, tokenVersion);
        return {
            token,
            expiresAt,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: user.emailVerified ?? false,
            },
        };
    }

    assertDashboardAdminAuthorization(authorization?: string) {
        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing dashboard admin bearer token");
        }

        const providedToken = authorization.slice("Bearer ".length).trim();

        if (!providedToken) {
            throw new UnauthorizedException("Missing dashboard admin bearer token");
        }

        const expectedToken = this.configService.get<string>("DASHBOARD_ADMIN_TOKEN");

        if (!expectedToken) {
            throw new InternalServerErrorException("DASHBOARD_ADMIN_TOKEN is not configured");
        }

        const providedBuffer = Buffer.from(providedToken);
        const expectedBuffer = Buffer.from(expectedToken);

        if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
            throw new UnauthorizedException("Invalid dashboard admin bearer token");
        }
    }
}
