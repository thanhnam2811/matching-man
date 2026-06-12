import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import { CreateOrganizationDto } from "./dto/create-organization.dto";

@Injectable()
export class OrganizationsService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(createOrganizationDto: CreateOrganizationDto) {
        try {
            return await this.prismaService.client.$transaction(async (tx) => {
                const owner = await tx.user.upsert({
                    where: {
                        email: createOrganizationDto.ownerEmail.toLowerCase(),
                    },
                    update: {
                        name: createOrganizationDto.ownerName ?? undefined,
                    },
                    create: {
                        email: createOrganizationDto.ownerEmail.toLowerCase(),
                        name: createOrganizationDto.ownerName,
                    },
                });

                return tx.organization.create({
                    data: {
                        name: createOrganizationDto.name,
                        slug: normalizeSlug(createOrganizationDto.slug),
                        createdById: owner.id,
                    },
                    include: {
                        createdBy: {
                            select: {
                                id: true,
                                email: true,
                                name: true,
                            },
                        },
                    },
                });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException("Organization slug already exists");
            }

            throw error;
        }
    }

    findAll() {
        return this.prismaService.client.organization.findMany({
            orderBy: {
                createdAt: "desc",
            },
            include: {
                projects: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
        });
    }

    async findOne(organizationId: string) {
        const organization = await this.prismaService.client.organization.findUnique({
            where: {
                id: organizationId,
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
                projects: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        defaultRegion: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        return organization;
    }
}