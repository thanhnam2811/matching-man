import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { MatchStatus } from "../../generated/prisma/client";

export class ListMatchesQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(64)
    gameModeId?: string;

    @IsOptional()
    @IsEnum(MatchStatus)
    status?: MatchStatus;

    @IsOptional()
    @IsDateString()
    from?: string;

    @IsOptional()
    @IsDateString()
    to?: string;

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