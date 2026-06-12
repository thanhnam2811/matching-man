import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@UseGuards(DashboardAdminGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Post()
    create(@Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationsService.create(createOrganizationDto);
    }

    @Get()
    findAll() {
        return this.organizationsService.findAll();
    }

    @Get(":organizationId")
    findOne(@Param("organizationId") organizationId: string) {
        return this.organizationsService.findOne(organizationId);
    }
}