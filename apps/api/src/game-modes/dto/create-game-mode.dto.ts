import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { MatchStructure, RatingMode } from "../../generated/prisma/client";

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateGameModeDto {
    @ApiProperty({ example: "ranked-5v5", maxLength: 120 })
    @IsString()
    @Matches(KEY_PATTERN)
    @MaxLength(120)
    key!: string;

    @ApiProperty({ example: "Ranked 5v5", maxLength: 120 })
    @IsString()
    @MaxLength(120)
    name!: string;

    @ApiProperty({ enum: MatchStructure })
    @IsEnum(MatchStructure)
    matchStructure!: MatchStructure;

    @ApiProperty({ minimum: 2, maximum: 64, description: "Total player slots across the match." })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(64)
    requiredSlots!: number;

    @ApiProperty({ minimum: 2, maximum: 64, description: "Number of opposing groups (e.g. 2 for teams A/B)." })
    @Type(() => Number)
    @IsInt()
    @Min(2)
    @Max(64)
    groupCount!: number;

    @ApiProperty({ minimum: 1, maximum: 64 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(64)
    teamSizeMin!: number;

    @ApiProperty({ minimum: 1, maximum: 64 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(64)
    teamSizeMax!: number;

    @ApiPropertyOptional({ enum: RatingMode })
    @IsOptional()
    @IsEnum(RatingMode)
    ratingMode?: RatingMode;

    @ApiPropertyOptional({ minimum: 1, description: "Initial rating band width for candidate matching." })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    initialRatingWindow?: number;

    @ApiPropertyOptional({ minimum: 1, description: "Seconds between each rating window expansion." })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    windowExpandIntervalSeconds?: number;

    @ApiPropertyOptional({ minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    windowExpandStep?: number;
}
