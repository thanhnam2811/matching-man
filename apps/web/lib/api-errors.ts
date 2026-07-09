// Error classes with no server-only dependencies, so client components (e.g.
// error.tsx boundaries) can import them without pulling in "next/headers".

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export class NetworkError extends Error {
    constructor(message = "Unable to reach the server. Check your connection and try again.") {
        super(message);
        this.name = "NetworkError";
    }
}

export class TimeoutError extends Error {
    constructor(message = "The server did not respond in time. Please try again.") {
        super(message);
        this.name = "TimeoutError";
    }
}
