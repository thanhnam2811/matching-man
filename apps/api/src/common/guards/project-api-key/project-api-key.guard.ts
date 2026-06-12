import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthenticatedProjectRequest } from "../../interfaces/authenticated-project-request";

@Injectable()
export class ProjectApiKeyGuard implements CanActivate {
    constructor(private readonly prismaService: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<AuthenticatedProjectRequest>();
        const authorization = request.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing bearer API key");
        }

        const token = authorization.slice("Bearer ".length).trim();

        if (!token) {
            throw new UnauthorizedException("Missing bearer API key");
        }

        const hashedKey = createHash("sha256").update(token).digest("hex");
        const apiKey = await this.prismaService.client.apiKey.findFirst({
            where: {
                hashedKey,
                isRevoked: false,
            },
            select: {
                id: true,
                projectId: true,
            },
        });

        if (!apiKey) {
            throw new UnauthorizedException("Invalid API key");
        }

        request.authProjectId = apiKey.projectId;
        request.authApiKeyId = apiKey.id;

        return true;
    }
}