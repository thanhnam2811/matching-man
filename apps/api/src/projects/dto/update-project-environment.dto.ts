import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProjectEnvironmentDto {
    @ApiPropertyOptional({ maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    name?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
