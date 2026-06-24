import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@UseGuards(DashboardAuthGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Post()
    create(@Req() request: DashboardAuthRequest, @Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationsService.create(toDashboardContext(request), createOrganizationDto);
    }

    @Get()
    findAll(@Req() request: DashboardAuthRequest) {
        return this.organizationsService.findAll(toDashboardContext(request));
    }

    @Get(":organizationId")
    findOne(@Req() request: DashboardAuthRequest, @Param("organizationId") organizationId: string) {
        return this.organizationsService.findOne(toDashboardContext(request), organizationId);
    }
}