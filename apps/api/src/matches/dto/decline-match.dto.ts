import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class DeclineMatchDto {
    @ApiProperty({ example: "player-123", maxLength: 120 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    playerId!: string;

    @ApiProperty({ example: "team-456", maxLength: 120 })
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    teamId!: string;

    @ApiPropertyOptional({ example: "User pressed cancel", maxLength: 500 })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}
