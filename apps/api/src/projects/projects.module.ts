import { Module } from "@nestjs/common";
import { ProjectEnvironmentsService } from "./project-environments.service";
import { ProjectMembersService } from "./project-members.service";
import { ProjectsService } from "./projects.service";
import { ProjectsController } from "./projects.controller";
import { ProjectEnvironmentsController } from "./project-environments.controller";
import { ProjectMembersController } from "./project-members.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    providers: [ProjectsService, ProjectEnvironmentsService, ProjectMembersService],
    exports: [ProjectEnvironmentsService],
    controllers: [ProjectsController, ProjectEnvironmentsController, ProjectMembersController],
})
export class ProjectsModule {}