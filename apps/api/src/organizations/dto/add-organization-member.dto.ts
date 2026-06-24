import { IsEmail, IsEnum, MaxLength } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class AddOrganizationMemberDto {
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}