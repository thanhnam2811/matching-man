import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateGameModeDto } from "./dto/create-game-mode.dto";
import { GameModesService } from "./game-modes.service";

@Controller("projects/:projectId/game-modes")
export class GameModesController {
    constructor(private readonly gameModesService: GameModesService) {}

    @Post()
    create(@Param("projectId") projectId: string, @Body() createGameModeDto: CreateGameModeDto) {
        return this.gameModesService.create(projectId, createGameModeDto);
    }

    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.gameModesService.findAll(projectId);
    }
}