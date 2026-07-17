import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma, ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import type { AddOrganizationMemberDto } from "./dto/add-organization-member.dto";
import type { UpdateOrganizationMemberDto } from "./dto/update-organization-member.dto";

export const ROLE_RANK: Record<ProjectMemberRole, number> = {
    [ProjectMemberRole.OWNER]: 3,
    [ProjectMemberRole.ADMIN]: 2,
    [ProjectMemberRole.MEMBER]: 1,
};

@Injectable()
export class OrganizationsService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(context: DashboardAuthContext, dto: CreateOrganizationDto) {
        const userId = this.requireUser(context);

        try {
            return await this.prismaService.client.$transaction(async (tx) => {
                let slug = normalizeSlug(dto.slug?.trim() || dto.name);
                if (await tx.organization.findUnique({ where: { slug } })) {
                    slug = `${slug}-${randomBytes(3).toString("hex")}`;
                }

                const organization = await tx.organization.create({
                    data: { name: dto.name, slug, createdById: userId },
                });

                await tx.organizationMember.create({
                    data: { organizationId: organization.id, userId, role: ProjectMemberRole.OWNER },
                });

                return { id: organization.id, name: organization.name, slug: organization.slug, role: "OWNER" };
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException("Organization slug already exists");
            }
            throw error;
        }
    }

    async findAll(context: DashboardAuthContext) {
        const organizations = await this.prismaService.client.organization.findMany({
            where: context.isSuperAdmin ? {} : { members: { some: { userId: context.authUserId } } },
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { projects: true, members: true } },
            },
        });

        return organizations.map((organization) => ({
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            projectCount: organization._count.projects,
            memberCount: organization._count.members,
            createdAt: organization.createdAt,
        }));
    }

    async findOne(context: DashboardAuthContext, organizationId: string) {
        await this.assertAccess(context, organizationId);

        const organization = await this.prismaService.client.organization.findUnique({
            where: { id: organizationId },
            include: {
                projects: {
                    orderBy: { createdAt: "desc" },
                    select: { id: true, name: true, slug: true, defaultRegion: true, createdAt: true },
                },
            },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            createdAt: organization.createdAt,
            projects: organization.projects,
        };
    }

    async listMembers(context: DashboardAuthContext, organizationId: string) {
        await this.assertAccess(context, organizationId);

        const members = await this.prismaService.client.organizationMember.findMany({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                role: true,
                createdAt: true,
                user: { select: { id: true, email: true, name: true } },
            },
        });

        return members;
    }

    async addMember(context: DashboardAuthContext, organizationId: string, dto: AddOrganizationMemberDto) {
        await this.assertAccess(context, organizationId, ProjectMemberRole.ADMIN);

        const user = await this.prismaService.client.user.findUnique({
            where: { email: dto.email.trim().toLowerCase() },
            select: { id: true, email: true, name: true },
        });

        if (!user) {
            throw new NotFoundException("No registered user with that email; ask them to sign up first");
        }

        const existing = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: user.id } },
        });

        if (existing) {
            throw new ConflictException("User is already a member of this organization");
        }

        const member = await this.prismaService.client.organizationMember.create({
            data: { organizationId, userId: user.id, role: dto.role },
            select: { id: true, role: true, createdAt: true, user: { select: { id: true, email: true, name: true } } },
        });

        return member;
    }

    async updateMember(
        context: DashboardAuthContext,
        organizationId: string,
        memberId: string,
        dto: UpdateOrganizationMemberDto,
    ) {
        await this.assertAccess(context, organizationId, ProjectMemberRole.ADMIN);

        const member = await this.findMemberOrThrow(organizationId, memberId);

        if (member.role === ProjectMemberRole.OWNER && dto.role !== ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(organizationId);
        }

        return this.prismaService.client.organizationMember.update({
            where: { id: memberId },
            data: { role: dto.role },
            select: { id: true, role: true, createdAt: true, user: { select: { id: true, email: true, name: true } } },
        });
    }

    async removeMember(context: DashboardAuthContext, organizationId: string, memberId: string) {
        await this.assertAccess(context, organizationId, ProjectMemberRole.ADMIN);

        const member = await this.findMemberOrThrow(organizationId, memberId);

        if (member.role === ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(organizationId);
        }

        await this.prismaService.client.organizationMember.delete({ where: { id: memberId } });

        return { id: memberId, removed: true };
    }

    /**
     * Ensures the caller may act on the organization. Super-admins bypass membership.
     * Throws `ForbiddenException` when the user is not a member or lacks the minimum role.
     */
    async assertAccess(
        context: DashboardAuthContext,
        organizationId: string,
        minRole: ProjectMemberRole = ProjectMemberRole.MEMBER,
    ) {
        if (context.isSuperAdmin) {
            return;
        }

        const membership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId: this.requireUser(context) } },
            select: { role: true },
        });

        if (!membership || ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
            throw new ForbiddenException("You do not have access to this organization");
        }
    }

    private async findMemberOrThrow(organizationId: string, memberId: string) {
        const member = await this.prismaService.client.organizationMember.findFirst({
            where: { id: memberId, organizationId },
            select: { id: true, role: true },
        });

        if (!member) {
            throw new NotFoundException("Organization member not found");
        }

        return member;
    }

    private async assertNotLastOwner(organizationId: string) {
        const ownerCount = await this.prismaService.client.organizationMember.count({
            where: { organizationId, role: ProjectMemberRole.OWNER },
        });

        if (ownerCount <= 1) {
            throw new BadRequestException("An organization must keep at least one owner");
        }
    }

    private requireUser(context: DashboardAuthContext): string {
        if (!context.authUserId) {
            throw new BadRequestException("A user session is required for this action");
        }
        return context.authUserId;
    }
}
