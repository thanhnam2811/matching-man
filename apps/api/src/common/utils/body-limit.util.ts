export function getBodyLimitKb(): string {
    return `${process.env.REQUEST_BODY_LIMIT_KB ?? 256}kb`;
}
