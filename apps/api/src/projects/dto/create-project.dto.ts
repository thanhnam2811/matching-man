import {
    ArrayMinSize,
    IsArray,
    IsEmail,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    ValidateIf,
    ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class OwnerDto {
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;
}

class OrganizationDto {
    @IsString()
    @MaxLength(120)
    name!: string;

    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug!: string;
}

export class CreateProjectDto {
    @IsString()
    @MaxLength(120)
    name!: string;

    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug!: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    defaultRegion?: string;

    @IsOptional()
    @IsString()
    @MaxLength(64)
    organizationId?: string;

    @ValidateNested()
    @Type(() => OwnerDto)
    owner!: OwnerDto;

    @ValidateIf((value: CreateProjectDto) => !value.organizationId)
    @ValidateNested()
    @Type(() => OrganizationDto)
    organization?: OrganizationDto;

    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    environments?: string[];
}