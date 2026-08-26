import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateProjectDto {
    @ApiPropertyOptional({ example: "Arena Game", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiPropertyOptional({ example: "us-east", maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    defaultRegion?: string;

    @ApiPropertyOptional({
        default: true,
        description: "Whether queue dodgers and AFK players receive temporary lockouts.",
    })
    @IsOptional()
    @IsBoolean()
    enableDodgePenalty?: boolean;

    @ApiPropertyOptional({
        example: [180, 900, 3600, 86400],
        description: "Array of penalty durations in seconds by violation tier.",
    })
    @IsOptional()
    @IsArray()
    @IsInt({ each: true })
    @Min(10, { each: true })
    penaltyTiers?: number[];

    @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 168, description: "Hours until violation count decays." })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(168)
    penaltyDecayHours?: number;
}
