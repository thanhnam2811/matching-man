import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedProjectRequest } from "../common/interfaces/authenticated-project-request";
import { ProjectApiKeyGuard } from "../common/guards/project-api-key/project-api-key.guard";
import { PROJECT_API_KEY_SECURITY } from "../swagger";
import { DequeueDto } from "./dto/dequeue.dto";
import { EnqueueDto } from "./dto/enqueue.dto";
import { QueuesService } from "./queues.service";

@ApiTags("Queues")
@ApiBearerAuth(PROJECT_API_KEY_SECURITY)
@UseGuards(ProjectApiKeyGuard)
@Controller("queues")
export class QueuesController {
    constructor(private readonly queuesService: QueuesService) {}

    @ApiOperation({ summary: "Add a team or solo player to a matchmaking pool." })
    @Post("enqueue")
    enqueue(@Req() request: AuthenticatedProjectRequest, @Body() enqueueDto: EnqueueDto) {
        return this.queuesService.enqueue(request.authProjectId, enqueueDto);
    }

    @ApiOperation({ summary: "Remove a waiting entry from the queue." })
    @Post("dequeue")
    dequeue(@Req() request: AuthenticatedProjectRequest, @Body() dequeueDto: DequeueDto) {
        return this.queuesService.dequeue(request.authProjectId, dequeueDto);
    }

    @ApiOperation({ summary: "List active pools and waiting counts for the authenticated project." })
    @Get("pools")
    listPools(@Req() request: AuthenticatedProjectRequest) {
        return this.queuesService.listPools(request.authProjectId);
    }
}
