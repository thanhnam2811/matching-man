import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateOrganizationDto {
    @ApiProperty({ example: "Arena Studio", maxLength: 120 })
    @IsString()
    @MaxLength(120)
    name!: string;

    @ApiPropertyOptional({ description: "Derived from name when omitted.", example: "arena-studio", maxLength: 120 })
    @IsOptional()
    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug?: string;
}
