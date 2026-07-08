import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateWebhookDto {
    @ApiPropertyOptional({ example: "https://game.example.com/match-callback" })
    @IsOptional()
    @IsUrl({
        protocols: ["http", "https"],
        require_protocol: true,
    })
    url?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    events?: string[];

    @ApiPropertyOptional({ maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    secret?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
