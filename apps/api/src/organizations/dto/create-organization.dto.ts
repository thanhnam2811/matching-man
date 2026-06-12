import { IsEmail, IsOptional, IsString, Matches, MaxLength } from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateOrganizationDto {
    @IsString()
    @MaxLength(120)
    name!: string;

    @IsString()
    @Matches(SLUG_PATTERN)
    @MaxLength(120)
    slug!: string;

    @IsEmail()
    ownerEmail!: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    ownerName?: string;
}