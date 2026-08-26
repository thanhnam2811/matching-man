import { ApiProperty } from "@nestjs/swagger";
import { IsHexadecimal, IsNotEmpty, IsString, Length, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
    @ApiProperty({
        description: "64-character hexadecimal password reset token",
        example: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    })
    @IsString()
    @IsNotEmpty()
    @IsHexadecimal()
    @Length(64, 64, { message: "Reset token must be a valid 64-character hex string" })
    token!: string;

    @ApiProperty({
        description: "New user password (minimum 8 characters)",
        minLength: 8,
        maxLength: 128,
        example: "CorrectHorseBatteryStaple123!",
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string;
}
