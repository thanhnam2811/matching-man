import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class ListRatingHistoryQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    playerId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    gameModeId?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(200)
    limit?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number;
}