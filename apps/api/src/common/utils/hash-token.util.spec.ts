import { createHash } from "node:crypto";
import { hashToken } from "./hash-token.util";

describe("hashToken", () => {
    it("returns the sha256 hex digest of the input", () => {
        const expected = createHash("sha256").update("secret-token").digest("hex");

        expect(hashToken("secret-token")).toBe(expected);
    });

    it("produces different digests for different inputs", () => {
        expect(hashToken("a")).not.toBe(hashToken("b"));
    });
});
