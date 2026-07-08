import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
    @ApiProperty({ example: "owner@example.com", maxLength: 160 })
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @ApiProperty({ minLength: 8, maxLength: 200, writeOnly: true })
    @IsString()
    @MinLength(8)
    @MaxLength(200)
    password!: string;

    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiPropertyOptional({ description: "Personal organization created for this user.", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    organizationName?: string;

    @ApiPropertyOptional({ description: "Derived from organizationName when omitted.", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    organizationSlug?: string;
}
