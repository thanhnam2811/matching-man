// eslint-disable-next-line import/no-unassigned-import -- polyfill metadata reflection for class-transformer in unit tests
import "reflect-metadata";
import { validateEnv } from "./env.validation";

describe("validateEnv", () => {
    const baseConfig = {
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/matching_hub",
        DASHBOARD_ADMIN_TOKEN: "dashboard-admin-token",
        SESSION_SECRET: "session-secret-key",
    };

    it("populates default Redis environment variables", () => {
        const config = validateEnv({ ...baseConfig });

        expect(config.REDIS_HOST).toBe("localhost");
        expect(config.REDIS_PORT).toBe(6379);
        expect(config.REDIS_PASSWORD).toBeUndefined();
    });

    it("accepts custom Redis environment variables and converts port to number", () => {
        const config = validateEnv({
            ...baseConfig,
            REDIS_HOST: "redis.internal",
            REDIS_PORT: "6380",
            REDIS_PASSWORD: "redis-secret-pass",
        });

        expect(config.REDIS_HOST).toBe("redis.internal");
        expect(config.REDIS_PORT).toBe(6380);
        expect(config.REDIS_PASSWORD).toBe("redis-secret-pass");
    });

    it("throws when REDIS_PORT is out of range", () => {
        expect(() =>
            validateEnv({
                ...baseConfig,
                REDIS_PORT: "70000",
            }),
        ).toThrow(/REDIS_PORT/);
    });
});
