import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { getBodyLimitKb } from "./common/utils/body-limit.util";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RequestLoggingInterceptor } from "./common/interceptors/request-logging.interceptor";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE, setupSwagger } from "./swagger";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bufferLogs: true,
    });
    const logger = new Logger("Bootstrap");

    // helmet must run before body parsing so error responses (e.g. 413 from an
    // oversized body) still get security headers set on the way out.
    app.use(helmet());

    const bodyLimit = getBodyLimitKb();
    app.useBodyParser("json", { limit: bodyLimit });
    app.useBodyParser("urlencoded", { limit: bodyLimit, extended: true });
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
