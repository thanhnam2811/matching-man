import { Module } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationMembersController } from "./organization-members.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    providers: [OrganizationsService],
    controllers: [OrganizationsController, OrganizationMembersController],
    exports: [OrganizationsService],
})
export class OrganizationsModule {}