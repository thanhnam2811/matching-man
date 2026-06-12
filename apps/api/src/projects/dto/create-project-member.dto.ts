import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class CreateProjectMemberDto {
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
