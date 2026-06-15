import { Type } from "class-transformer";
import { IsDateString, IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class ReportResultDto {
    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    winnerGroupIndex?: number;

    @IsDateString()
    endedAt!: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}