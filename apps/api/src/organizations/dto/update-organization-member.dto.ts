import { IsEnum } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class UpdateOrganizationMemberDto {
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}