import { IsOptional, IsString, MaxLength } from "class-validator";

export class DequeueDto {
    @IsOptional()
    @IsString()
    @MaxLength(120)
    idempotencyKey?: string;

    @IsString()
    @MaxLength(64)
    queueEntryId!: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    reason?: string;
}