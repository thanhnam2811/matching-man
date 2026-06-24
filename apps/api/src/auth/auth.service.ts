import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";
import { PasswordService } from "./password.service";
import { SessionTokenService } from "./session-token.service";

type SessionUser = {
    id: string;
    email: string;
    name: string | null;
    passwordHash: string | null;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
        private readonly passwordService: PasswordService,
        private readonly sessionTokenService: SessionTokenService,
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
                data: { email, name: dto.name?.trim() || null, passwordHash },
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

            return created;
        });

        return this.issueSession(user);
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();
        const user = await this.prismaService.client.user.findUnique({ where: { email } });

        if (!user?.passwordHash || !(await this.passwordService.verify(dto.password, user.passwordHash))) {
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
                organizationMemberships: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        role: true,
                        organization: { select: { id: true, name: true, slug: true } },
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
            organizations: user.organizationMemberships.map((membership) => ({
                id: membership.organization.id,
                name: membership.organization.name,
                slug: membership.organization.slug,
                role: membership.role,
            })),
        };
    }

    private issueSession(user: SessionUser) {
        const { token, expiresAt } = this.sessionTokenService.sign(user.id);
        return {
            token,
            expiresAt,
            user: { id: user.id, email: user.email, name: user.name },
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