import { Controller, Get, HttpCode, HttpStatus, NotFoundException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DemoService } from "./demo.service";

@ApiTags("Demo")
@Controller("demo")
export class DemoController {
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
}
