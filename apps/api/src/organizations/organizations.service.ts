import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prismaService: PrismaService) {}

  findAll() {
    return this.prismaService.client.organization.findMany({
      orderBy: {
        createdAt: 'desc',
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
}
