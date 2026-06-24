import { PasswordService } from "./password.service";

describe("PasswordService", () => {
    const service = new PasswordService();

    it("hashes then verifies the same password", async () => {
        const hash = await service.hash("correct horse battery staple");
        expect(hash).toContain(":");
        await expect(service.verify("correct horse battery staple", hash)).resolves.toBe(true);
    });

    it("rejects a wrong password", async () => {
        const hash = await service.hash("right-password");
        await expect(service.verify("wrong-password", hash)).resolves.toBe(false);
    });

    it("produces a different salt each time", async () => {
        const first = await service.hash("same");
        const second = await service.hash("same");
        expect(first).not.toBe(second);
    });

    it("returns false for a malformed stored hash", async () => {
        await expect(service.verify("anything", "not-a-valid-hash")).resolves.toBe(false);
    });
});