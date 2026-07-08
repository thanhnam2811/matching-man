import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class DequeueDto {
    @ApiPropertyOptional({ example: "deq_001", maxLength: 120 })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    idempotencyKey?: string;

    @ApiProperty({ example: "qe_123", maxLength: 64 })
    @IsString()
    @MaxLength(64)
    queueEntryId!: string;

    @ApiPropertyOptional({ example: "party_cancelled", maxLength: 255 })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    reason?: string;
}
