import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class ForgotPasswordDto {
    @ApiProperty({
        description: "Email address associated with the user account",
        example: "operator@example.com",
    })
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email!: string;
}
