import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class QueryPenaltiesDto {
    @ApiPropertyOptional({ enum: ["ACTIVE", "EXPIRED", "REVOKED"], description: "Filter by status" })
    @IsOptional()
    @IsString()
    @IsIn(["ACTIVE", "EXPIRED", "REVOKED"])
    status?: "ACTIVE" | "EXPIRED" | "REVOKED";

    @ApiPropertyOptional({ description: "Filter by player ID prefix/match" })
    @IsOptional()
    @IsString()
    playerId?: string;

    @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({ default: 0, minimum: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number;
}
