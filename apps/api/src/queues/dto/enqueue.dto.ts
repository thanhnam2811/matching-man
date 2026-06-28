import { Type } from "class-transformer";
import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

class EnqueueTeamMemberDto {
    @IsString()
    @MaxLength(120)
    playerId!: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    rating?: number;
}

class EnqueueTeamDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    externalTeamId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EnqueueTeamMemberDto)
    members!: EnqueueTeamMemberDto[];
}

export class EnqueueDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    idempotencyKey?: string;

    @IsString()
    @MaxLength(64)
    projectId!: string;

    @IsString()
    @MaxLength(64)
    gameModeId!: string;

    @IsString()
    @MaxLength(64)
    environment!: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    region?: string;

    @ValidateNested()
    @Type(() => EnqueueTeamDto)
    team!: EnqueueTeamDto;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
