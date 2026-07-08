import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("Organizations")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @ApiOperation({ summary: "Create a tenant owned by the caller." })
    @Post()
    create(@Req() request: DashboardAuthRequest, @Body() createOrganizationDto: CreateOrganizationDto) {
        return this.organizationsService.create(toDashboardContext(request), createOrganizationDto);
    }

    @ApiOperation({ summary: "List organizations the caller belongs to." })
    @Get()
    findAll(@Req() request: DashboardAuthRequest) {
        return this.organizationsService.findAll(toDashboardContext(request));
    }

    @ApiOperation({ summary: "Get a single organization." })
    @Get(":organizationId")
    findOne(@Req() request: DashboardAuthRequest, @Param("organizationId") organizationId: string) {
        return this.organizationsService.findOne(toDashboardContext(request), organizationId);
    }
}
