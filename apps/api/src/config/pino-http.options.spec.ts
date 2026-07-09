import { IncomingMessage, ServerResponse } from "node:http";
import { buildPinoHttpOptions } from "./pino-http.options";

function callGenReqId(headers: Record<string, string | string[] | undefined>) {
    const options = buildPinoHttpOptions("production", "info");
    const setHeader = jest.fn();
    const req = { headers } as unknown as IncomingMessage;
    const res = { setHeader } as unknown as ServerResponse;
    const id = options.genReqId!(req, res);

    return { id, setHeader };
}

describe("buildPinoHttpOptions", () => {
    it("silences logging in the test environment regardless of the configured level", () => {
        const options = buildPinoHttpOptions("test", "debug");

        expect(options.level).toBe("silent");
    });

    it("uses the configured log level outside the test environment", () => {
        const options = buildPinoHttpOptions("production", "warn");

        expect(options.level).toBe("warn");
    });

    it("redacts the authorization and cookie headers", () => {
        const options = buildPinoHttpOptions("production", "info");

        expect(options.redact).toMatchObject({
            paths: ["req.headers.authorization", "req.headers.cookie"],
        });
    });

    describe("genReqId", () => {
        it("reuses the x-request-id header when present", () => {
            const { id, setHeader } = callGenReqId({ "x-request-id": "client-supplied-id" });

            expect(id).toBe("client-supplied-id");
            expect(setHeader).toHaveBeenCalledWith("x-request-id", "client-supplied-id");
        });

        it("takes the first value when x-request-id is sent as multiple headers", () => {
            const { id } = callGenReqId({ "x-request-id": ["first-id", "second-id"] });

            expect(id).toBe("first-id");
        });

        it("generates a new id and sets the response header when the header is absent", () => {
            const { id, setHeader } = callGenReqId({});

            expect(typeof id).toBe("string");
            expect((id as string).length).toBeGreaterThan(0);
            expect(setHeader).toHaveBeenCalledWith("x-request-id", id);
        });
    });
});
