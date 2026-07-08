import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE, buildOpenApiDocument } from "./swagger";

async function generate() {
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });
    const document = buildOpenApiDocument(app);
    const outputPath = resolve(__dirname, "../../../../docs/openapi.json");

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(document, null, 2) + "\n");
    await app.close();

    // eslint-disable-next-line no-console
    console.log(`OpenAPI document written to ${outputPath}`);
}

void generate();
