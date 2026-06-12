import { Module } from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { MatchesController } from "./matches.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";

@Module({
    imports: [PrismaModule],
    providers: [MatchesService, ProjectApiKeyGuard],
    controllers: [MatchesController],
})
export class MatchesModule {}