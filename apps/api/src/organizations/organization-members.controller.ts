import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { AddOrganizationMemberDto } from "./dto/add-organization-member.dto";
import { UpdateOrganizationMemberDto } from "./dto/update-organization-member.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("Organization Members")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard)
@Controller("organizations/:organizationId/members")
export class OrganizationMembersController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @ApiOperation({ summary: "List organization members." })
    @Get()
    findAll(@Req() request: DashboardAuthRequest, @Param("organizationId") organizationId: string) {
        return this.organizationsService.listMembers(toDashboardContext(request), organizationId);
    }

    @ApiOperation({ summary: "Add an already-registered user as an organization member. Requires ADMIN or OWNER." })
    @Post()
    add(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Body() dto: AddOrganizationMemberDto,
    ) {
        return this.organizationsService.addMember(toDashboardContext(request), organizationId, dto);
    }

    @ApiOperation({ summary: "Change a member's role. Requires ADMIN or OWNER." })
    @Patch(":memberId")
    update(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Param("memberId") memberId: string,
        @Body() dto: UpdateOrganizationMemberDto,
    ) {
        return this.organizationsService.updateMember(toDashboardContext(request), organizationId, memberId, dto);
    }

    @ApiOperation({
        summary: "Remove a member. Requires ADMIN or OWNER; an organization must keep at least one OWNER.",
    })
    @Delete(":memberId")
    remove(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Param("memberId") memberId: string,
    ) {
        return this.organizationsService.removeMember(toDashboardContext(request), organizationId, memberId);
    }
}
