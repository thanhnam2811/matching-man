import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class ReportResultDto {
    @ApiPropertyOptional({ example: "result_001" })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @ApiPropertyOptional({ minimum: 1, description: "Index of the winning group; omit for a draw." })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    winnerGroupIndex?: number;

    @ApiProperty({ example: "2026-06-12T00:25:00Z" })
    @IsDateString()
    endedAt!: string;

    @ApiPropertyOptional({
        type: "object",
        additionalProperties: true,
        example: { duration_seconds: 1490, server_match_id: "gs_abc_999" },
    })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
