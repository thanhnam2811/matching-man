import { ConfigService } from "@nestjs/config";
import { RedisService } from "./redis.service";

const mockPing = jest.fn();
const mockQuit = jest.fn();
const mockDisconnect = jest.fn();
const mockOn = jest.fn();

jest.mock("ioredis", () => {
    return {
        Redis: jest.fn().mockImplementation(() => ({
            ping: mockPing,
            quit: mockQuit,
            disconnect: mockDisconnect,
            on: mockOn,
        })),
        default: jest.fn().mockImplementation(() => ({
            ping: mockPing,
            quit: mockQuit,
            disconnect: mockDisconnect,
            on: mockOn,
        })),
    };
});

describe("RedisService", () => {
    let configService: ConfigService;

    beforeEach(() => {
        jest.clearAllMocks();
        configService = {
            get: jest.fn((key: string, defaultVal?: unknown) => {
                const config: Record<string, unknown> = {
                    REDIS_HOST: "localhost",
                    REDIS_PORT: 6379,
                    REDIS_PASSWORD: "secret-password",
                };
                return config[key] ?? defaultVal;
            }),
        } as unknown as ConfigService;
    });

    it("returns true when redis.ping() responds with PONG", async () => {
        mockPing.mockResolvedValue("PONG");
        const service = new RedisService(configService);

        const healthy = await service.isHealthy();

        expect(healthy).toBe(true);
        expect(mockPing).toHaveBeenCalled();
    });

    it("returns false when redis.ping() returns something unexpected", async () => {
        mockPing.mockResolvedValue("NOT_PONG");
        const service = new RedisService(configService);

        const healthy = await service.isHealthy();

        expect(healthy).toBe(false);
    });

    it("returns false when redis.ping() throws an error", async () => {
        mockPing.mockRejectedValue(new Error("Connection refused"));
        const service = new RedisService(configService);

        const healthy = await service.isHealthy();

        expect(healthy).toBe(false);
    });

    it("gracefully quits redis client on module destroy", async () => {
        mockQuit.mockResolvedValue("OK");
        const service = new RedisService(configService);

        await service.onModuleDestroy();

        expect(mockQuit).toHaveBeenCalled();
    });

    it("falls back to disconnect if quit fails on module destroy", async () => {
        mockQuit.mockRejectedValue(new Error("Quit error"));
        const service = new RedisService(configService);

        await service.onModuleDestroy();

        expect(mockDisconnect).toHaveBeenCalled();
    });
});
