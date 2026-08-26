import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreatePortalSessionDto {
    @ApiPropertyOptional({
        description: "Return URL after exiting Stripe Customer Portal (validated against APP_WEB_URL)",
        example: "http://localhost:3001/dashboard/organizations/org_123/billing",
    })
    @IsOptional()
    @IsString()
    returnUrl?: string;
}
