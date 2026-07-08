import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { WebhookDeliveryStatus } from "../../generated/prisma/client";

export class ListDeliveriesQueryDto {
    @ApiPropertyOptional({ enum: WebhookDeliveryStatus })
    @IsOptional()
    @IsEnum(WebhookDeliveryStatus)
    status?: WebhookDeliveryStatus;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    endpointId?: string;

    @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiPropertyOptional({ minimum: 0, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;
}
