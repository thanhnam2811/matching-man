import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, MaxLength } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class AddOrganizationMemberDto {
    @ApiProperty({ description: "The invitee must already be registered.", maxLength: 160 })
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @ApiProperty({ enum: ProjectMemberRole })
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
