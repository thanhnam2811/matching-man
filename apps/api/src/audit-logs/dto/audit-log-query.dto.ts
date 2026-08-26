import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { AuditAction, AuditResourceType } from "../../generated/prisma/client";

export class AuditLogQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @ApiPropertyOptional({ default: 50, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50;

    @ApiPropertyOptional({ enum: AuditAction })
    @IsOptional()
    @IsEnum(AuditAction)
    action?: AuditAction;

    @ApiPropertyOptional({ enum: AuditResourceType })
    @IsOptional()
    @IsEnum(AuditResourceType)
    resourceType?: AuditResourceType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    actorUserId?: string;
}
