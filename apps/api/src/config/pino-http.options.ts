import { randomUUID } from "node:crypto";
import type { Options } from "pino-http";

export function buildPinoHttpOptions(nodeEnv: string, logLevel: string): Options {
    return {
        level: nodeEnv === "test" ? "silent" : logLevel,
        redact: {
            paths: ["req.headers.authorization", "req.headers.cookie"],
            remove: true,
        },
        genReqId: (req, res) => {
            const raw = req.headers["x-request-id"];
            const existing = Array.isArray(raw) ? raw[0] : raw;
            const id = existing && existing.length > 0 ? existing : randomUUID();

            res.setHeader("x-request-id", id);

            return id;
        },
    };
}
