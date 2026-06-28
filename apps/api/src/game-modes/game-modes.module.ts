import { Module } from "@nestjs/common";
import { GameModesService } from "./game-modes.service";
import { GameModesController } from "./game-modes.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    providers: [GameModesService],
    controllers: [GameModesController],
    exports: [GameModesService],
})
export class GameModesModule {}
