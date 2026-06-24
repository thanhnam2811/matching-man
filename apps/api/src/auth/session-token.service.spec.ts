import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SessionTokenService } from "./session-token.service";

describe("SessionTokenService", () => {
    const configService = { getOrThrow: jest.fn().mockReturnValue("test-session-secret") };
    const service = new SessionTokenService(configService as unknown as ConfigService);

    it("signs a token that verifies back to the user id", () => {
        const { token, expiresAt } = service.sign("user_1");
        expect(service.verify(token)).toBe("user_1");
        expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("rejects a tampered payload", () => {
        const { token } = service.sign("user_1");
        const [, signature] = token.split(".");
        const forged = `${Buffer.from(JSON.stringify({ sub: "attacker", exp: 9999999999 })).toString("base64url")}.${signature}`;
        expect(() => service.verify(forged)).toThrow(UnauthorizedException);
    });

    it("rejects a malformed token", () => {
        expect(() => service.verify("garbage")).toThrow(UnauthorizedException);
    });

    it("rejects an expired token", () => {
        const expiredPayload = Buffer.from(JSON.stringify({ sub: "user_1", exp: 1 })).toString("base64url");
        // Re-sign through a fresh instance using the same secret so the signature is valid but expiry is past.
        const signing = new SessionTokenService(configService as unknown as ConfigService);
        const signature = (signing as unknown as { signature(payload: string): string }).signature(expiredPayload);
        expect(() => service.verify(`${expiredPayload}.${signature}`)).toThrow(UnauthorizedException);
    });
});