import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @ApiOperation({ summary: "Report service liveness, DB connectivity, and scheduler status." })
    @Get()
    getHealth() {
        return this.healthService.getHealth();
    }
}
