import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProjectEnvironmentDto {
    @ApiProperty({ example: "production", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    name!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
