import { ApiProperty } from "@nestjs/swagger";
import { IsHexadecimal, IsNotEmpty, IsString, Length } from "class-validator";

export class VerifyEmailDto {
    @ApiProperty({
        description: "64-character hexadecimal email verification token",
        example: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    })
    @IsString()
    @IsNotEmpty()
    @IsHexadecimal()
    @Length(64, 64, { message: "Verification token must be a valid 64-character hex string" })
    token!: string;
}
