import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Logger, NotFoundException, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DemoService } from "./demo.service";

@ApiTags("Demo")
@Controller("demo")
export class DemoController {
    private readonly logger = new Logger(DemoController.name);

    constructor(private readonly demoService: DemoService) {}

    @ApiOperation({
        summary: "Live config for the public matchmaking sandbox — project id, API key, and game mode ids.",
    })
    @Get("config")
    @HttpCode(HttpStatus.OK)
    async getConfig() {
        const config = await this.demoService.getPublicConfig();
        if (!config) {
            throw new NotFoundException("Demo not configured");
        }
        return config;
    }

    // Delivery target for the demo-arena project's webhook endpoint (see
    // DEMO_WEBHOOK_URL) — a real, always-succeeding sink so live matches from
    // the public /demo sandbox produce genuine successful deliveries instead
    // of failing against a placeholder host. No signature verification: this
    // endpoint has nothing to protect, it only logs and acknowledges receipt.
    @ApiOperation({
        summary: "Delivery target for the demo project's webhook endpoint — logs and acknowledges receipt.",
    })
    @Post("webhook-sink")
    @HttpCode(HttpStatus.OK)
    receiveWebhook(@Body() body: unknown, @Headers("x-webhook-event") event?: string) {
        this.logger.log(`Demo webhook received: ${event ?? "unknown-event"}`);
        return { ok: true };
    }
}
