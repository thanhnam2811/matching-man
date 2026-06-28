import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { AddOrganizationMemberDto } from "./dto/add-organization-member.dto";
import { UpdateOrganizationMemberDto } from "./dto/update-organization-member.dto";
import { OrganizationsService } from "./organizations.service";

@UseGuards(DashboardAuthGuard)
@Controller("organizations/:organizationId/members")
export class OrganizationMembersController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Get()
    findAll(@Req() request: DashboardAuthRequest, @Param("organizationId") organizationId: string) {
        return this.organizationsService.listMembers(toDashboardContext(request), organizationId);
    }

    @Post()
    add(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Body() dto: AddOrganizationMemberDto,
    ) {
        return this.organizationsService.addMember(toDashboardContext(request), organizationId, dto);
    }

    @Patch(":memberId")
    update(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Param("memberId") memberId: string,
        @Body() dto: UpdateOrganizationMemberDto,
    ) {
        return this.organizationsService.updateMember(toDashboardContext(request), organizationId, memberId, dto);
    }

    @Delete(":memberId")
    remove(
        @Req() request: DashboardAuthRequest,
        @Param("organizationId") organizationId: string,
        @Param("memberId") memberId: string,
    ) {
        return this.organizationsService.removeMember(toDashboardContext(request), organizationId, memberId);
    }
}
