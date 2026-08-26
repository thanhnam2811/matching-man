import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { ProjectMemberRole } from "../generated/prisma/client";
import { OrganizationsService } from "../organizations/organizations.service";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { BillingService } from "./billing.service";
import { BillingWebhookService } from "./billing-webhook.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { CreatePortalSessionDto } from "./dto/create-portal-session.dto";

@ApiTags("Billing")
@Controller()
export class BillingController {
    constructor(
        private readonly billingService: BillingService,
        private readonly billingWebhookService: BillingWebhookService,
        private readonly organizationsService: OrganizationsService,
    ) {}

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Get subscription details and usage limits for an organization." })
    @UseGuards(DashboardAuthGuard)
    @Get("organizations/:id/billing/subscription")
    async getSubscription(@Param("id") organizationId: string, @Req() req: DashboardAuthRequest) {
        await this.organizationsService.assertAccess(toDashboardContext(req), organizationId, ProjectMemberRole.MEMBER);
        return this.billingService.getSubscription(organizationId);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Get monthly usage metrics for an organization." })
    @UseGuards(DashboardAuthGuard)
    @Get("organizations/:id/billing/usage")
    async getUsage(@Param("id") organizationId: string, @Req() req: DashboardAuthRequest) {
        await this.organizationsService.assertAccess(toDashboardContext(req), organizationId, ProjectMemberRole.MEMBER);
        return this.billingService.getSubscription(organizationId);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Initiate Stripe Checkout session to upgrade or change subscription." })
    @UseGuards(DashboardAuthGuard)
    @Post("organizations/:id/billing/checkout")
    async createCheckout(
        @Param("id") organizationId: string,
        @Req() req: DashboardAuthRequest,
        @Body() dto: CreateCheckoutSessionDto,
    ) {
        const context = toDashboardContext(req);
        await this.organizationsService.assertAccess(context, organizationId, ProjectMemberRole.ADMIN);
        return this.billingService.createCheckoutSession(organizationId, context.authUserId || "user_default", dto);
    }

    @ApiBearerAuth(SESSION_TOKEN_SECURITY)
    @ApiOperation({ summary: "Generate a Stripe Customer Portal session URL." })
    @UseGuards(DashboardAuthGuard)
    @Post("organizations/:id/billing/portal")
    async createPortal(
        @Param("id") organizationId: string,
        @Req() req: DashboardAuthRequest,
        @Body() dto: CreatePortalSessionDto,
    ) {
        const context = toDashboardContext(req);
        await this.organizationsService.assertAccess(context, organizationId, ProjectMemberRole.ADMIN);
        return this.billingService.createBillingPortalSession(
            organizationId,
            context.authUserId || "user_default",
            dto,
        );
    }

    @ApiOperation({ summary: "Stripe webhook endpoint for subscription and payment events." })
    @HttpCode(HttpStatus.OK)
    @Post("billing/webhook")
    async handleWebhook(@Headers("stripe-signature") signature: string, @Req() req: any) {
        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException("Raw request body is missing for Stripe webhook verification");
        }
        return this.billingWebhookService.processWebhook(rawBody, signature || "");
    }
}
