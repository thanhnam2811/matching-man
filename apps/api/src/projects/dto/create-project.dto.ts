import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProjectDto {
    @ApiProperty({ example: "Arena VN", maxLength: 120 })
    @IsString()
    @MaxLength(120)
    name!: string;

    @ApiProperty({ example: "arena-vn", maxLength: 120 })
    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug!: string;

    @ApiProperty({ description: "Organization the caller belongs to.", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    organizationId!: string;

    @ApiPropertyOptional({ example: "ap-southeast-1", maxLength: 64 })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    defaultRegion?: string;

    @ApiPropertyOptional({ type: [String], example: ["development", "production"] })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    environments?: string[];
}
