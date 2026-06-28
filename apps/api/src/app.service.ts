import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppService {
    constructor(private readonly configService: ConfigService) {}

    getInfo() {
        return {
            service: "matching-hub-api",
            environment: this.configService.get<string>("NODE_ENV", "development"),
            version: "phase-2",
        };
    }
}
