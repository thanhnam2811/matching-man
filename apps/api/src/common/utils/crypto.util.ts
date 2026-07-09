import { randomBytes } from "node:crypto";
import { hashToken } from "./hash-token.util";

export function generateApiKey() {
    const raw = `mhub_${randomBytes(24).toString("hex")}`;

    return {
        raw,
        hashed: hashToken(raw),
        prefix: raw.slice(0, 9),
        lastFour: raw.slice(-4),
    };
}

export function generateSigningSecret() {
    return `whsec_${randomBytes(24).toString("hex")}`;
}
