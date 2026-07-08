import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

class EnqueueTeamMemberDto {
    @ApiProperty({ example: "p1", maxLength: 120 })
    @IsString()
    @MaxLength(120)
    playerId!: string;

    @ApiPropertyOptional({ example: 1510 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    rating?: number;
}

class EnqueueTeamDto {
    @ApiPropertyOptional({ example: "team_1001", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    externalTeamId?: string;

    @ApiProperty({ type: [EnqueueTeamMemberDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EnqueueTeamMemberDto)
    members!: EnqueueTeamMemberDto[];
}

export class EnqueueDto {
    @ApiPropertyOptional({ example: "enq_001", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    idempotencyKey?: string;

    @ApiProperty({ example: "proj_123", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    projectId!: string;

    @ApiProperty({ example: "mode_ranked_5v5", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    gameModeId!: string;

    @ApiProperty({ example: "production", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    environment!: string;

    @ApiPropertyOptional({ example: "ap-southeast-1", maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    region?: string;

    @ApiProperty({ type: EnqueueTeamDto })
    @ValidateNested()
    @Type(() => EnqueueTeamDto)
    team!: EnqueueTeamDto;

    @ApiPropertyOptional({ type: "object", additionalProperties: true, example: { party_size: 2 } })
    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
