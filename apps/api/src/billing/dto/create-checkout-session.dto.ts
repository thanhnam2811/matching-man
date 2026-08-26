import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { SubscriptionPlanTier } from "../../generated/prisma/client";

export class CreateCheckoutSessionDto {
    @ApiProperty({
        enum: SubscriptionPlanTier,
        description: "Target subscription plan tier",
        example: "PRO",
    })
    @IsNotEmpty()
    @IsEnum(SubscriptionPlanTier)
    planTier: SubscriptionPlanTier = SubscriptionPlanTier.PRO;

    @ApiPropertyOptional({
        description: "Return URL after completing Checkout (validated against APP_WEB_URL)",
        example: "http://localhost:3001/dashboard/organizations/org_123/billing",
    })
    @IsOptional()
    @IsString()
    returnUrl?: string;
}
