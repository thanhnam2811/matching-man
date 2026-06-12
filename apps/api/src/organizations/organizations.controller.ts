import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardAdminGuard } from "../common/guards/dashboard-admin/dashboard-admin.guard";
import { OrganizationsService } from "./organizations.service";

@UseGuards(DashboardAdminGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) {}

    @Get()
    findAll() {
        return this.organizationsService.findAll();
    }
}