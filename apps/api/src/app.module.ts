import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
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
import { DashboardModule } from "./dashboard/dashboard.module";
import { ProjectThrottlerGuard } from "./common/guards/project-throttler/project-throttler.guard";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,
            envFilePath: [".env.development.local", ".env.development", ".env"],
            validate: validateEnv,
        }),
        ThrottlerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => [
                {
                    name: "default",
                    ttl: config.get<number>("THROTTLE_TTL_MS")!,
                    limit: config.get<number>("THROTTLE_LIMIT")!,
                },
            ],
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
        DashboardModule,
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_GUARD, useClass: ProjectThrottlerGuard }],
})
export class AppModule {}
