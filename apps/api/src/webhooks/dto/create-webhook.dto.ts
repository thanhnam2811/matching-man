import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateWebhookDto {
    @ApiProperty({ example: "https://game.example.com/match-callback" })
    @IsUrl({
        protocols: ["http", "https"],
        require_protocol: true,
    })
    url!: string;

    @ApiProperty({
        type: [String],
        example: ["match.created", "match.failed", "queue.timeout", "match.completed", "rating.updated"],
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    events!: string[];

    @ApiPropertyOptional({ description: "Signing secret; auto-generated when omitted.", maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    secret?: string;
}
