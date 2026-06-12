import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateWebhookDto {
    @IsUrl({
        protocols: ["http", "https"],
        require_protocol: true,
    })
    url!: string;

    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    events!: string[];

    @IsOptional()
    @IsString()
    @MaxLength(255)
    secret?: string;
}