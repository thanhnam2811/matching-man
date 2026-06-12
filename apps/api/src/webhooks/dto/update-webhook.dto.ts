import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateWebhookDto {
    @IsOptional()
    @IsUrl({
        protocols: ["http", "https"],
        require_protocol: true,
    })
    url?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    events?: string[];

    @IsOptional()
    @IsString()
    @MaxLength(255)
    secret?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}