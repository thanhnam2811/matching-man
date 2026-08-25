import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class RejectDisputeDto {
    @ApiProperty({
        example: "Insufficient evidence provided. Replay shows legitimate game behavior.",
        maxLength: 1000,
        description: "Mandatory operator resolution notes explaining the rationale for rejecting the dispute.",
    })
    @IsString()
    @MaxLength(1000)
    resolutionNotes!: string;
}
