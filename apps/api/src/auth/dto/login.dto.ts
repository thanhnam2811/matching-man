import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength } from "class-validator";

export class LoginDto {
    @ApiProperty({ example: "owner@example.com", maxLength: 160 })
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @ApiProperty({ maxLength: 200, writeOnly: true })
    @IsString()
    @MaxLength(200)
    password!: string;
}
