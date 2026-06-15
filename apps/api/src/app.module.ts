import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ProjectsModule } from "./projects/projects.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { GameModesModule } from "./game-modes/game-modes.module";
import { QueuesModule } from "./queues/queues.module";
import { MatchesModule } from "./matches/matches.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";
import { RatingsModule } from "./ratings/ratings.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: [".env.development.local", ".env.development", ".env"],
            validate: validateEnv,
        }),
        ScheduleModule.forRoot(),
        HealthModule,
        PrismaModule,
        AuthModule,
        OrganizationsModule,
        ProjectsModule,
        ApiKeysModule,
        WebhooksModule,
        GameModesModule,
        QueuesModule,
        MatchesModule,
        DeliveriesModule,
        RatingsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}