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
