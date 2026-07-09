import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { Request, Response } from "express";

type ErrorEnvelope = {
    success: false;
    error: {
        statusCode: number;
        code: string;
        message: string;
        details?: unknown;
    };
    requestId: string;
    timestamp: string;
    path: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const context = host.switchToHttp();
        const request = context.getRequest<Request>();
        const response = context.getResponse<Response>();
        const statusCode = this.getStatusCode(exception);
        const payload = this.buildErrorEnvelope(exception, request, statusCode);

        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                JSON.stringify({
                    event: "request_error",
                    method: request.method,
                    path: request.originalUrl ?? request.url,
                    statusCode,
                    code: payload.error.code,
                    message: payload.error.message,
                    requestId: payload.requestId,
                }),
                exception instanceof Error ? exception.stack : undefined,
            );
        }

        response.status(statusCode).json(payload);
    }

    private buildErrorEnvelope(exception: unknown, request: Request, statusCode: number): ErrorEnvelope {
        const timestamp = new Date().toISOString();
        const path = request.originalUrl ?? request.url;
        const { code, details, message } = this.extractErrorParts(exception, statusCode);

        return {
            success: false,
            error: {
                statusCode,
                code,
                message,
                ...(details === undefined ? {} : { details }),
            },
            requestId: this.getRequestId(request),
            timestamp,
            path,
        };
    }

    private getRequestId(request: Request): string {
        // Set by pino-http's genReqId (see src/config/pino-http.options.ts) before
        // any guard/filter runs — either the client's own x-request-id or a
        // generated UUID, always present by the time a filter executes.
        const id = (request as Request & { id?: string | number }).id;

        return id === undefined ? "" : String(id);
    }

    private extractErrorParts(
        exception: unknown,
        statusCode: number,
    ): {
        code: string;
        details?: unknown;
        message: string;
    } {
        if (exception instanceof HttpException) {
            const response = exception.getResponse();

            if (typeof response === "string") {
                return {
                    code: this.getErrorCode(statusCode),
                    message: response,
                };
            }

            if (this.isObject(response)) {
                const rawMessage = response.message;
                const details = Array.isArray(rawMessage) ? rawMessage : undefined;
                const message =
                    typeof rawMessage === "string"
                        ? rawMessage
                        : typeof response.error === "string"
                          ? response.error
                          : exception.message;

                return {
                    code: this.getErrorCode(statusCode),
                    ...(details === undefined ? {} : { details }),
                    message,
                };
            }

            return {
                code: this.getErrorCode(statusCode),
                message: exception.message,
            };
        }

        if (exception instanceof Error) {
            return {
                code: this.getErrorCode(statusCode),
                message: statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? "Internal server error" : exception.message,
            };
        }

        return {
            code: this.getErrorCode(statusCode),
            message: statusCode >= HttpStatus.INTERNAL_SERVER_ERROR ? "Internal server error" : "Request failed",
        };
    }

    private getStatusCode(exception: unknown): number {
        if (exception instanceof HttpException) {
            return exception.getStatus();
        }

        // Express/body-parser errors (e.g. PayloadTooLargeError) are built via the
        // `http-errors` package and are not HttpExceptions. Match http-errors' own
        // shape check (status === statusCode, boolean expose) rather than trusting
        // any Error that happens to carry a numeric status/statusCode field —
        // otherwise an unrelated error (e.g. from an HTTP client library) with a
        // similarly-named property would get its value reinterpreted as this
        // response's status code.
        if (exception instanceof Error) {
            const err = exception as unknown as Record<string, unknown>;

            if (
                typeof err.expose === "boolean" &&
                typeof err.statusCode === "number" &&
                err.status === err.statusCode &&
                err.statusCode >= 400 &&
                err.statusCode < 600
            ) {
                return err.statusCode;
            }
        }

        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    private getErrorCode(statusCode: number): string {
        return HttpStatus[statusCode] ?? "INTERNAL_SERVER_ERROR";
    }

    private isObject(value: unknown): value is {
        error?: unknown;
        message?: unknown;
    } {
        return typeof value === "object" && value !== null;
    }
}
