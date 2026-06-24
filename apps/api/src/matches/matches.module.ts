import { Module } from "@nestjs/common";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { RatingsModule } from "../ratings/ratings.module";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";

@Module({
    imports: [PrismaModule, DeliveriesModule, RatingsModule],
    providers: [MatchesService, ProjectApiKeyGuard],
    controllers: [MatchesController],
    exports: [MatchesService],
})
export class MatchesModule {}