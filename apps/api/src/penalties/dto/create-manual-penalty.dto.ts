import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { PenaltyReason } from "../../generated/prisma/client";

export class CreateManualPenaltyDto {
    @ApiProperty({ example: "player-123", maxLength: 120 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    playerId!: string;

    @ApiProperty({ example: 1800, minimum: 10, maximum: 2592000, description: "Duration in seconds." })
    @Type(() => Number)
    @IsInt()
    @Min(10)
    @Max(2592000)
    durationSeconds!: number;

    @ApiPropertyOptional({ enum: PenaltyReason, default: PenaltyReason.MANUAL_LOCKOUT })
    @IsOptional()
    @IsEnum(PenaltyReason)
    reason?: PenaltyReason;

    @ApiPropertyOptional({ example: "Toxic behavior in pre-game chat", maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    notes?: string;
}
