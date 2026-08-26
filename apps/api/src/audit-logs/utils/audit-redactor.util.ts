const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /hash/i,
    /secret/i,
    /token/i,
    /api_?key/i,
    /private_?key/i,
    /authorization/i,
    /cookie/i,
    /credit_?card|card_?number|cvv|cvc/i,
    /stripe/i,
    /credential/i,
];

const MAX_PAYLOAD_BYTES = 32 * 1024; // 32KB cap

function sanitizeObject(data: unknown): unknown {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data !== "object") {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitizeObject(item));
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
        if (isSensitive) {
            sanitized[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

export function redactSensitiveData<T>(data: T): T {
    if (data === null || data === undefined) {
        return data;
    }

    if (typeof data !== "object") {
        return data;
    }

    const sanitized = sanitizeObject(data);

    // Check payload size bound for both object and array structures
    try {
        const jsonString = JSON.stringify(sanitized);
        if (Buffer.byteLength(jsonString, "utf8") > MAX_PAYLOAD_BYTES) {
            return {
                warning: "[TRUNCATED: Payload exceeded 32KB storage limit]",
                summary: Array.isArray(sanitized)
                    ? `Array length: ${sanitized.length}`
                    : Object.keys(sanitized as object),
            } as unknown as T;
        }
    } catch {
        // Fallback for unstringifiable circular structures
        return { warning: "[UNSTRINGIFIABLE_PAYLOAD]" } as unknown as T;
    }

    return sanitized as T;
}
