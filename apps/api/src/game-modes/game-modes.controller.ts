import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateGameModeDto } from "./dto/create-game-mode.dto";
import { GameModesService } from "./game-modes.service";

@ApiTags("Game Modes")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/game-modes")
export class GameModesController {
    constructor(private readonly gameModesService: GameModesService) {}

    @ApiOperation({ summary: "Create a game mode for a project." })
    @Post()
    create(@Param("projectId") projectId: string, @Body() createGameModeDto: CreateGameModeDto) {
        return this.gameModesService.create(projectId, createGameModeDto);
    }

    @ApiOperation({ summary: "List game modes for a project." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.gameModesService.findAll(projectId);
    }
}
