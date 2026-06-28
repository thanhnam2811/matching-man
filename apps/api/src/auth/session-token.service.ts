import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
    sub: string;
    exp: number;
};

@Injectable()
export class SessionTokenService {
    constructor(private readonly configService: ConfigService) {}

    sign(userId: string): { token: string; expiresAt: Date } {
        const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
        const payloadB64 = Buffer.from(JSON.stringify({ sub: userId, exp } satisfies SessionPayload)).toString(
            "base64url",
        );

        return {
            token: `${payloadB64}.${this.signature(payloadB64)}`,
            expiresAt: new Date(exp * 1000),
        };
    }

    verify(token: string): string {
        const [payloadB64, providedSignature] = token.split(".");

        if (!payloadB64 || !providedSignature) {
            throw new UnauthorizedException("Malformed session token");
        }

        const expectedSignature = this.signature(payloadB64);
        const providedBuffer = Buffer.from(providedSignature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
            throw new UnauthorizedException("Invalid session token");
        }

        let payload: SessionPayload;

        try {
            payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as SessionPayload;
        } catch {
            throw new UnauthorizedException("Invalid session token");
        }

        if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
            throw new UnauthorizedException("Session expired");
        }

        return payload.sub;
    }

    private signature(payloadB64: string): string {
        const secret = this.configService.getOrThrow<string>("SESSION_SECRET");
        return createHmac("sha256", secret).update(payloadB64).digest("base64url");
    }
}
