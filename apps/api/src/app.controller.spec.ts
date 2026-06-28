import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                AppService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: (_key: string, fallback?: string) => fallback,
                    },
                },
            ],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe("root", () => {
        it("should return service metadata", () => {
            expect(appController.getInfo()).toEqual({
                service: "matching-hub-api",
                environment: "development",
                version: "phase-2",
            });
        });
    });
});
