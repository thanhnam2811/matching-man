import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMatchDisputeDto {
    @ApiPropertyOptional({
        example: "team_1",
        description: "The ID of the team filing the dispute.",
    })
    @IsOptional()
    @IsString()
    claimantTeamId?: string;

    @ApiProperty({
        example: "Player was using unauthorized third-party software during the match.",
        maxLength: 500,
        description: "Detailed reason for the dispute (maximum 500 characters).",
    })
    @IsString()
    @MaxLength(500)
    reason!: string;

    @ApiPropertyOptional({
        type: "object",
        additionalProperties: true,
        example: { replayUrl: "https://example.com/replays/match_1.dem", round: 4 },
        description: "Optional metadata or evidence supporting the dispute claim.",
    })
    @IsOptional()
    @IsObject()
    evidence?: Record<string, unknown>;
}

export { CreateMatchDisputeDto as CreateDisputeDto };
