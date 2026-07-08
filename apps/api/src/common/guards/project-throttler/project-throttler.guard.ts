import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { hashToken } from "../../utils/hash-token.util";

type TrackedRequest = {
    headers: { authorization?: string };
    ip: string;
};

@Injectable()
export class ProjectThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(req: TrackedRequest): Promise<string> {
        const authorization = req.headers.authorization;

        if (authorization?.startsWith("Bearer ")) {
            const token = authorization.slice("Bearer ".length).trim();

            if (token) {
                return hashToken(token);
            }
        }

        return req.ip;
    }
}
