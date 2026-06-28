import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    organizationName?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    organizationSlug?: string;
}
