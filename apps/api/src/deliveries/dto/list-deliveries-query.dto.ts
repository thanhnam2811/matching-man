import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { WebhookDeliveryStatus } from "../../generated/prisma/client";

export class ListDeliveriesQueryDto {
    @IsOptional()
    @IsEnum(WebhookDeliveryStatus)
    status?: WebhookDeliveryStatus;

    @IsOptional()
    @IsString()
    endpointId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;
}
