import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { DequeueDto } from "./dto/dequeue.dto";
import { EnqueueDto } from "./dto/enqueue.dto";
import { QueuesService } from "./queues.service";

@UseGuards(ProjectApiKeyGuard)
@Controller("queues")
export class QueuesController {
    constructor(private readonly queuesService: QueuesService) {}

    @Post("enqueue")
    enqueue(@Req() request: AuthenticatedProjectRequest, @Body() enqueueDto: EnqueueDto) {
        return this.queuesService.enqueue(request.authProjectId, enqueueDto);
    }

    @Post("dequeue")
    dequeue(@Req() request: AuthenticatedProjectRequest, @Body() dequeueDto: DequeueDto) {
        return this.queuesService.dequeue(request.authProjectId, dequeueDto);
    }

    @Get("pools")
    listPools(@Req() request: AuthenticatedProjectRequest) {
        return this.queuesService.listPools(request.authProjectId);
    }
}