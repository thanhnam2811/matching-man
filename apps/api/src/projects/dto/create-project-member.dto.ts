import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class CreateProjectMemberDto {
    @ApiProperty()
    @IsEmail()
    email!: string;

    @ApiPropertyOptional({ maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiProperty({ enum: ProjectMemberRole })
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
