import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
    async hash(password: string): Promise<string> {
        const salt = randomBytes(16);
        const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
        return `${salt.toString("hex")}:${derived.toString("hex")}`;
    }

    async verify(password: string, stored: string): Promise<boolean> {
        const [saltHex, hashHex] = stored.split(":");

        if (!saltHex || !hashHex) {
            return false;
        }

        const expected = Buffer.from(hashHex, "hex");
        const derived = (await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length)) as Buffer;

        return expected.length === derived.length && timingSafeEqual(expected, derived);
    }
}