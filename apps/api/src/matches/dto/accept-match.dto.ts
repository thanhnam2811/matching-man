import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AcceptMatchDto {
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
}
