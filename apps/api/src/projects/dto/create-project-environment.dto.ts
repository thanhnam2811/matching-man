import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProjectEnvironmentDto {
    @IsString()
    @MaxLength(64)
    name!: string;

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
