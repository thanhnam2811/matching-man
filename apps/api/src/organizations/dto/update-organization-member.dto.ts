import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class UpdateOrganizationMemberDto {
    @ApiProperty({ enum: ProjectMemberRole })
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
