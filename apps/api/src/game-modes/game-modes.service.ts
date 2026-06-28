import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStructure, RatingMode } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeSlug } from "../common/utils/slug.util";
import { CreateGameModeDto } from "./dto/create-game-mode.dto";

@Injectable()
export class GameModesService {
    constructor(private readonly prismaService: PrismaService) {}

    async create(projectId: string, createGameModeDto: CreateGameModeDto) {
        await this.ensureProjectExists(projectId);
        this.validateModeShape(createGameModeDto);
        this.validateRatingWindowConfig(createGameModeDto);

        try {
            return await this.prismaService.client.gameMode.create({
                data: {
                    projectId,
                    key: normalizeSlug(createGameModeDto.key),
                    name: createGameModeDto.name,
                    matchStructure: createGameModeDto.matchStructure,
                    requiredSlots: createGameModeDto.requiredSlots,
                    groupCount: createGameModeDto.groupCount,
                    teamSizeMin: createGameModeDto.teamSizeMin,
                    teamSizeMax: createGameModeDto.teamSizeMax,
                    ratingMode: createGameModeDto.ratingMode ?? RatingMode.DISABLED,
                    initialRatingWindow: createGameModeDto.initialRatingWindow ?? null,
                    windowExpandIntervalSeconds: createGameModeDto.windowExpandIntervalSeconds ?? null,
                    windowExpandStep: createGameModeDto.windowExpandStep ?? null,
                },
            });
        } catch {
            throw new ConflictException("Game mode key already exists for this project");
        }
    }

    findAll(projectId: string) {
        return this.prismaService.client.gameMode.findMany({
            where: {
                projectId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    async findOne(projectId: string, gameModeId: string) {
        const gameMode = await this.prismaService.client.gameMode.findFirst({
            where: {
                id: gameModeId,
                projectId,
            },
        });

        if (!gameMode) {
            throw new NotFoundException("Game mode not found");
        }

        return gameMode;
    }

    private validateRatingWindowConfig(dto: CreateGameModeDto) {
        const windowFields = [dto.initialRatingWindow, dto.windowExpandIntervalSeconds, dto.windowExpandStep];
        const setCount = windowFields.filter((v) => v !== undefined).length;

        if (setCount > 0 && setCount < 3) {
            throw new BadRequestException(
                "initialRatingWindow, windowExpandIntervalSeconds, and windowExpandStep must all be set together",
            );
        }

        if (setCount === 3 && dto.ratingMode !== RatingMode.EXTERNAL_RATING) {
            throw new BadRequestException("Rating window config is only valid when ratingMode is EXTERNAL_RATING");
        }
    }

    private validateModeShape(createGameModeDto: CreateGameModeDto) {
        if (createGameModeDto.teamSizeMin > createGameModeDto.teamSizeMax) {
            throw new ConflictException("teamSizeMin cannot be greater than teamSizeMax");
        }

        if (createGameModeDto.groupCount > createGameModeDto.requiredSlots) {
            throw new ConflictException("groupCount cannot be greater than requiredSlots");
        }

        if (createGameModeDto.matchStructure === MatchStructure.VERSUS && createGameModeDto.groupCount !== 2) {
            throw new ConflictException("VERSUS modes must use groupCount = 2");
        }

        if (
            createGameModeDto.matchStructure === MatchStructure.FFA &&
            createGameModeDto.groupCount !== createGameModeDto.requiredSlots
        ) {
            throw new ConflictException("FFA modes must use groupCount equal to requiredSlots");
        }
    }

    private async ensureProjectExists(projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: {
                id: projectId,
            },
            select: {
                id: true,
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }
    }
}
