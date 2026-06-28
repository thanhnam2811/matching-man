import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { MatchStructure, RatingMode } from "../../generated/prisma/client";

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateGameModeDto {
    @IsString()
    @Matches(KEY_PATTERN)
    @MaxLength(120)
    key!: string;

    @IsString()
    @MaxLength(120)
    name!: string;

    @IsEnum(MatchStructure)
    matchStructure!: MatchStructure;

    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(64)
    requiredSlots!: number;

    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(64)
    groupCount!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(64)
    teamSizeMin!: number;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(64)
    teamSizeMax!: number;

    @IsOptional()
    @IsEnum(RatingMode)
    ratingMode?: RatingMode;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    initialRatingWindow?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    windowExpandIntervalSeconds?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    windowExpandStep?: number;
}
