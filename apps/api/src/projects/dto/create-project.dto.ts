import { ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProjectDto {
    @IsString()
    @MaxLength(120)
    name!: string;

    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug!: string;

    @IsString()
    @MaxLength(64)
    organizationId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    defaultRegion?: string;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    environments?: string[];
}
