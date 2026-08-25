import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { Logger as PinoLogger } from "nestjs-pino";
import { WorkerAppModule } from "./worker-app.module";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(WorkerAppModule, {
        bufferLogs: true,
    });

    app.useLogger(app.get(PinoLogger));
    const logger = new Logger("WorkerBootstrap");

    app.enableShutdownHooks();

    logger.log("Worker application context initialized");
}
void bootstrap();
