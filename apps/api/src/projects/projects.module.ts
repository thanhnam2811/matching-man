import { Module } from "@nestjs/common";
import { ProjectEnvironmentsService } from "./project-environments.service";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    providers: [ProjectsService, ProjectEnvironmentsService],
    exports: [ProjectEnvironmentsService],
    controllers: [ProjectsController],
})
export class ProjectsModule {}
