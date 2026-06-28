import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { Request, Response } from "express";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger("HTTP");

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        if (context.getType() !== "http") {
            return next.handle();
        }

        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();
        const startedAt = process.hrtime.bigint();

        return next.handle().pipe(
            finalize(() => {
                const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

                this.logger.log(
                    JSON.stringify({
                        event: "request_completed",
                        method: request.method,
                        path: request.originalUrl ?? request.url,
                        statusCode: response.statusCode,
                        durationMs: Number(durationMs.toFixed(2)),
                    }),
                );
            }),
        );
    }
}
