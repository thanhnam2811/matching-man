import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { DisputeStatus } from "../../generated/prisma/client";

export class ListDisputesQueryDto {
    @ApiPropertyOptional({ enum: DisputeStatus, description: "Filter by dispute status (OPEN, RESOLVED, REJECTED)." })
    @IsOptional()
    @IsEnum(DisputeStatus)
    status?: DisputeStatus;

    @ApiPropertyOptional({
        minimum: 1,
        maximum: 100,
        default: 50,
        description: "Maximum number of disputes to return.",
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiPropertyOptional({ minimum: 0, default: 0, description: "Number of records to skip for pagination." })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;
}
