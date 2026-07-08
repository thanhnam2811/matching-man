import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE, setupSwagger } from "./swagger";

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
    app.setGlobalPrefix(API_GLOBAL_PREFIX, {
        exclude: API_GLOBAL_PREFIX_EXCLUDE,
    });
    setupSwagger(app);

    const port = process.env.PORT ?? 3000;

    await app.listen(port);
    logger.log(`API listening on port ${port}`);
}
void bootstrap();
