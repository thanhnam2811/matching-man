import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProjectEnvironmentDto {
    @IsOptional()
    @IsString()
    @MaxLength(64)
    name?: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
