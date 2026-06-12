import { NestFactory } from "@nestjs/core";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        bufferLogs: true,
    });
    const logger = new Logger("Bootstrap");

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new RequestLoggingInterceptor());
    app.setGlobalPrefix("v1", {
        exclude: [{ path: "health", method: RequestMethod.GET }],
    });

    const port = process.env.PORT ?? 3000;

    await app.listen(port);
    logger.log(`API listening on port ${port}`);
}
void bootstrap();