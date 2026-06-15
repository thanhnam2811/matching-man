import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

@Module({
    imports: [PrismaModule],
    providers: [RatingsService, ProjectApiKeyGuard],
    controllers: [RatingsController],
    exports: [RatingsService],
})
export class RatingsModule {}