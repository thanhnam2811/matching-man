import { INestApplication, RequestMethod } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export const PROJECT_API_KEY_SECURITY = "projectApiKey";
export const SESSION_TOKEN_SECURITY = "sessionToken";
export const API_GLOBAL_PREFIX = "v1";
export const API_GLOBAL_PREFIX_EXCLUDE = [{ path: "health", method: RequestMethod.GET }];

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
    const config = new DocumentBuilder()
        .setTitle("Matching Man API")
        .setDescription(
            "Multi-tenant matchmaking platform API.\n\n" +
                "Game servers authenticate with a project API key (`" +
                PROJECT_API_KEY_SECURITY +
                "`) issued via `POST /v1/projects/:projectId/api-keys`.\n" +
                "The admin dashboard authenticates with a per-user session token from " +
                "`/v1/auth/login` or `/v1/auth/register`, or the break-glass `DASHBOARD_ADMIN_TOKEN` (`" +
                SESSION_TOKEN_SECURITY +
                "`).",
        )
        .setVersion("1")
        .addBearerAuth(
            {
                type: "http",
                scheme: "bearer",
                bearerFormat: "token",
                description: "Project API key, e.g. `Authorization: Bearer <project_api_key>`.",
            },
            PROJECT_API_KEY_SECURITY,
        )
        .addBearerAuth(
            {
                type: "http",
                scheme: "bearer",
                bearerFormat: "token",
                description: "Dashboard session token or admin token, e.g. `Authorization: Bearer <session_token>`.",
            },
            SESSION_TOKEN_SECURITY,
        )
        .build();

    return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup("v1/docs", app, document);
}
