import { Module } from "@nestjs/common";
import { DeliveriesModule } from "../deliveries/deliveries.module";
import { MatchesModule } from "../matches/matches.module";
import { QueuesModule } from "../queues/queues.module";
import { RatingsModule } from "../ratings/ratings.module";
import { DashboardController } from "./dashboard.controller";

@Module({
    imports: [QueuesModule, MatchesModule, DeliveriesModule, RatingsModule],
    controllers: [DashboardController],
})
export class DashboardModule {}
