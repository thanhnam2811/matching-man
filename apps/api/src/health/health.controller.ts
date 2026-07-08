import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { HealthService } from "./health.service";

@ApiTags("Health")
@SkipThrottle()
@Controller("health")
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @ApiOperation({ summary: "Report service liveness, DB connectivity, and scheduler status." })
    @Get()
    getHealth() {
        return this.healthService.getHealth();
    }
}
