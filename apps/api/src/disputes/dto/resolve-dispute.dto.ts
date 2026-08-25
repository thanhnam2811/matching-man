import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ResolveDisputeDto {
    @ApiPropertyOptional({
        minimum: 1,
        example: 2,
        description: "The winning group index override (1-based), or omit/null to declare a draw/void.",
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    overrideWinnerGroupIndex?: number | null;

    @ApiProperty({
        example: "Reviewed match replay clip. Player in team 1 was using prohibited client modifications.",
        maxLength: 1000,
        description: "Mandatory operator resolution notes explaining the rationale for the resolution.",
    })
    @IsString()
    @MaxLength(1000)
    resolutionNotes!: string;
}
