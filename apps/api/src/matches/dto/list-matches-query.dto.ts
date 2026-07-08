import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MatchStatus } from "../../generated/prisma/client";

export class ListMatchesQueryDto {
    @ApiPropertyOptional({ maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    gameModeId?: string;

    @ApiPropertyOptional({ enum: MatchStatus })
    @IsOptional()
    @IsEnum(MatchStatus)
    status?: MatchStatus;

    @ApiPropertyOptional({ description: "ISO 8601, applied to createdAt." })
    @IsOptional()
    @IsDateString()
    from?: string;

    @ApiPropertyOptional({ description: "ISO 8601, applied to createdAt." })
    @IsOptional()
    @IsDateString()
    to?: string;

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
