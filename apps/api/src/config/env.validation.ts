import { plainToInstance, Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, validateSync } from "class-validator";

class EnvironmentVariables {
    @IsEnum(["development", "test", "production"])
    NODE_ENV: "development" | "test" | "production" = "development";

    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(65535)
    PORT = 3000;

    @IsString()
    DATABASE_URL!: string;

    @IsOptional()
    @IsString()
    DATABASE_DIRECT_URL?: string;

    @IsString()
    @IsNotEmpty()
    DASHBOARD_ADMIN_TOKEN!: string;

    @IsString()
    @IsNotEmpty()
    SESSION_SECRET!: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    THROTTLE_TTL_MS = 60_000;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    THROTTLE_LIMIT = 120;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    AUTH_THROTTLE_TTL_MS = 60_000;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    AUTH_THROTTLE_LIMIT = 10;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    REQUEST_BODY_LIMIT_KB = 256;

    @IsEnum(["fatal", "error", "warn", "info", "debug", "trace"])
    LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace" = "info";
}

export function validateEnv(config: Record<string, unknown>) {
    const validatedConfig = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
        skipMissingProperties: false,
    });

    if (errors.length > 0) {
        throw new Error(errors.toString());
    }

    return validatedConfig;
}
