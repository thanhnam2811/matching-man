import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class UpdateProjectMemberDto {
    @ApiProperty({ enum: ProjectMemberRole })
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
