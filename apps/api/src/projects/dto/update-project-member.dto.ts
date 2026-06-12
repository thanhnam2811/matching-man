import { IsEnum } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class UpdateProjectMemberDto {
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}