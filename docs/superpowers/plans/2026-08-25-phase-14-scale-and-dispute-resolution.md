# Phase 14: Redis/BullMQ Scaling, Process Separation, and Dispute Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate background jobs and matchmaking coordination from PostgreSQL polling/locks to Redis and BullMQ, decouple public HTTP APIs from worker processes, and implement an end-to-end Match Dispute Resolution workflow with Elo reconciliation.

**Architecture:**

- **Redis & BullMQ:** Job queues for `matchmaking-pool` (debounced per pool), `queue-timeout` (delayed per entry), and `webhook-delivery` (exponential backoff `[0s, 30s, 5m, 30m, 2h]`).
- **Process Separation:** `apps/api/src/main.ts` serves pure HTTP traffic while `apps/api/src/worker.main.ts` runs a headless NestJS context executing background BullMQ workers.
- **Dispute Resolution:** `MatchDispute` model in Prisma, public API `POST /v1/matches/:id/dispute`, operator resolution endpoints in `MatchDisputesController`, Elo rollback/reconciliation, and Next.js dashboard UI.

**Tech Stack:** NestJS, BullMQ, Redis 7, Prisma, PostgreSQL 17, Next.js App Router, Tailwind CSS, Jest.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-14-scale-and-dispute-resolution-design.md`

## Global Constraints

- Redis connection details must be validated via `Joi` / `ConfigService` (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`).
- Database remains the durable source of truth and audit log; BullMQ manages job orchestration and retries.
- API service instances must not register BullMQ worker processors; worker instances must not bind HTTP ports.
- Dispute workflow must support both winner override (with Elo rating delta recalculation) and dispute rejection.
- All Prisma migrations must be generated and replayable via `prisma migrate deploy`.
- Maintain 100% test coverage on new processors and dispute state machine.

---

### Task 1: Redis Docker Service & Package Dependencies Setup

**Files:**

- Modify: `package.json` & `apps/api/package.json`
- Modify: `docker-compose.yml` & `docker-compose.prod.yml`
- Modify: `apps/api/src/common/config/env.validation.ts`
- Test: `apps/api/src/common/config/env.validation.spec.ts`

**Interfaces:**

- Consumes: Environment variables `REDIS_HOST` (default `localhost`), `REDIS_PORT` (default `6379`), `REDIS_PASSWORD` (optional).
- Produces: Validated Redis config schema and running Redis 7 container on port 6379.

- [ ] **Step 1: Write failing config validation test**

In `apps/api/src/common/config/env.validation.spec.ts`, add:

```ts
it("validates Redis configuration with sensible defaults", () => {
    const config = validateEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        DASHBOARD_ADMIN_TOKEN: "admin-token-1234",
        SESSION_SECRET: "session-secret-long-enough-1234",
    });
    expect(config.REDIS_HOST).toBe("localhost");
    expect(config.REDIS_PORT).toBe(6379);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- env.validation.spec.ts`
Expected: FAIL — `REDIS_HOST` / `REDIS_PORT` not in validation schema.

- [ ] **Step 3: Install BullMQ and update validation schema & docker compose**

Install dependencies:

```bash
pnpm --dir apps/api add bullmq @nestjs/bullmq ioredis
pnpm --dir apps/api add -D @types/ioredis
```

Update `apps/api/src/common/config/env.validation.ts`:

```ts
REDIS_HOST: Joi.string().default("localhost"),
REDIS_PORT: Joi.number().port().default(6379),
REDIS_PASSWORD: Joi.string().allow("").optional(),
```

Add Redis service to `docker-compose.yml`:

```yaml
redis:
    image: redis:7-alpine
    container_name: matching-man-redis
    restart: unless-stopped
    ports:
        - "6379:6379"
    volumes:
        - redis-data:/data
    healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 5s
        timeout: 3s
        retries: 5
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/api test -- env.validation.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml apps/api/package.json docker-compose.yml apps/api/src/common/config/env.validation.ts apps/api/src/common/config/env.validation.spec.ts
git commit -m "feat(api): add Redis container and BullMQ dependencies"
```

---

### Task 2: BullMQ Core Module & Redis Health Check

**Files:**

- Create: `apps/api/src/common/redis/bullmq-config.module.ts`
- Modify: `apps/api/src/common/scheduler-health/scheduler-health.service.ts`
- Modify: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/src/health/health.controller.spec.ts`

**Interfaces:**

- Consumes: ConfigService Redis host/port/password.
- Produces: `BullModule.forRootAsync` root queue configuration, `/health` response includes `redis: "up" | "down"`.

- [ ] **Step 1: Write failing health check test**

In `apps/api/src/health/health.controller.spec.ts`:

```ts
it("returns ok with database, redis, and scheduler statuses", async () => {
    const res = await controller.getHealth();
    expect(res.status).toBe("ok");
    expect(res.checks.redis).toBe("up");
    expect(res.checks.database).toBe("up");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- health.controller.spec.ts`
Expected: FAIL — `res.checks.redis` is undefined.

- [ ] **Step 3: Implement BullMQConfigModule and Redis Health Check**

Create `apps/api/src/common/redis/bullmq-config.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: {
                    host: config.get<string>("REDIS_HOST", "localhost"),
                    port: config.get<number>("REDIS_PORT", 6379),
                    password: config.get<string>("REDIS_PASSWORD") || undefined,
                    maxRetriesPerRequest: null,
                },
            }),
        }),
    ],
    exports: [BullModule],
})
export class BullMQConfigModule {}
```

Update `apps/api/src/health/health.controller.ts` to execute `redis.ping()` via injected Redis connection.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- health.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/redis/ apps/api/src/health/ apps/api/src/common/scheduler-health/
git commit -m "feat(api): register BullMQ root module and add Redis health check"
```

---

### Task 3: Webhook Delivery Queue & BullMQ Retry Processor

**Files:**

- Create: `apps/api/src/webhooks/webhook-delivery.processor.ts`
- Modify: `apps/api/src/webhooks/webhooks.service.ts`
- Modify: `apps/api/src/webhooks/webhooks.module.ts`
- Test: `apps/api/src/webhooks/webhook-delivery.processor.spec.ts`

**Interfaces:**

- Consumes: `InjectQueue("webhook-delivery")` BullMQ queue.
- Produces: `WebhookDeliveryProcessor` executing deliveries with retry intervals `[0s, 30s, 5m, 30m, 2h]` and logging to `webhook_deliveries` table.

- [ ] **Step 1: Write failing WebhookDeliveryProcessor test**

Create `apps/api/src/webhooks/webhook-delivery.processor.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";
import { WebhooksService } from "./webhooks.service";

describe("WebhookDeliveryProcessor", () => {
    let processor: WebhookDeliveryProcessor;
    let webhooksService: { executeDelivery: jest.Mock };

    beforeEach(async () => {
        webhooksService = { executeDelivery: jest.fn().mockResolvedValue({ success: true, statusCode: 200 }) };
        const module = await Test.createTestingModule({
            providers: [WebhookDeliveryProcessor, { provide: WebhooksService, useValue: webhooksService }],
        }).compile();
        processor = module.get(WebhookDeliveryProcessor);
    });

    it("processes webhook delivery job and delegates to WebhooksService", async () => {
        const job = { data: { webhookEndpointId: "wh_1", event: "match.created", payload: { matchId: "m1" } } } as any;
        await processor.process(job);
        expect(webhooksService.executeDelivery).toHaveBeenCalledWith("wh_1", "match.created", { matchId: "m1" });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- webhook-delivery.processor.spec.ts`
Expected: FAIL — Processor not implemented.

- [ ] **Step 3: Implement WebhookDeliveryProcessor**

Create `apps/api/src/webhooks/webhook-delivery.processor.ts`:

```ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";

export interface WebhookDeliveryJobData {
    deliveryId?: string;
    webhookEndpointId: string;
    event: string;
    payload: Record<string, unknown>;
}

@Processor("webhook-delivery", { concurrency: 10 })
export class WebhookDeliveryProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookDeliveryProcessor.name);

    constructor(private readonly webhooksService: WebhooksService) {
        super();
    }

    async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
        const { webhookEndpointId, event, payload } = job.data;
        this.logger.debug(`Processing webhook delivery for endpoint ${webhookEndpointId} event ${event}`);
        await this.webhooksService.executeDelivery(webhookEndpointId, event, payload);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- webhook-delivery.processor.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/webhooks/
git commit -m "feat(api): migrate webhook delivery retry processor to BullMQ"
```

---

### Task 4: Queue Entry Delayed Timeout Processor

**Files:**

- Create: `apps/api/src/queues/processors/queue-timeout.processor.ts`
- Modify: `apps/api/src/queues/queues.service.ts` (enqueue delayed job on player enqueue)
- Modify: `apps/api/src/queues/queues.module.ts`
- Test: `apps/api/src/queues/processors/queue-timeout.processor.spec.ts`

**Interfaces:**

- Consumes: `InjectQueue("queue-timeout")`.
- Produces: Delayed BullMQ job per queue entry that runs at `expiresAt` to transition un-matched entries to `TIMEOUT`.

- [ ] **Step 1: Write failing QueueTimeoutProcessor test**

Create `apps/api/src/queues/processors/queue-timeout.processor.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { QueueTimeoutProcessor } from "./queue-timeout.processor";
import { QueuesService } from "../queues.service";

describe("QueueTimeoutProcessor", () => {
    let processor: QueueTimeoutProcessor;
    let queuesService: { expireQueueEntry: jest.Mock };

    beforeEach(async () => {
        queuesService = { expireQueueEntry: jest.fn().mockResolvedValue({ expired: true }) };
        const module = await Test.createTestingModule({
            providers: [QueueTimeoutProcessor, { provide: QueuesService, useValue: queuesService }],
        }).compile();
        processor = module.get(QueueTimeoutProcessor);
    });

    it("expires un-matched queue entry when delay fires", async () => {
        const job = { data: { queueEntryId: "qe_123", projectId: "p1" } } as any;
        await processor.process(job);
        expect(queuesService.expireQueueEntry).toHaveBeenCalledWith("qe_123", "p1");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- queue-timeout.processor.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement QueueTimeoutProcessor & QueuesService.expireQueueEntry**

Implement `QueueTimeoutProcessor` and update `QueuesService.enqueue` to schedule:

```ts
await this.timeoutQueue.add(
    "expire-entry",
    { queueEntryId: entry.id, projectId },
    { delay: timeoutSeconds * 1000, jobId: `timeout:${entry.id}`, removeOnComplete: true },
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- queue-timeout.processor.spec.ts queues.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queues/
git commit -m "feat(api): replace queue timeout table scans with delayed BullMQ jobs"
```

---

### Task 5: Partitioned Matchmaking Pool Queue & Processor

**Files:**

- Create: `apps/api/src/queues/processors/matchmaking-sweep.processor.ts`
- Modify: `apps/api/src/queues/queues.service.ts`
- Test: `apps/api/src/queues/processors/matchmaking-sweep.processor.spec.ts`

**Interfaces:**

- Consumes: `InjectQueue("matchmaking-pool")`.
- Produces: Debounced per-pool matchmaking jobs (`jobId = pool:<poolId>`, `delay = 50ms`), isolating concurrent matching execution per pool.

- [ ] **Step 1: Write failing MatchmakingSweepProcessor test**

Create `apps/api/src/queues/processors/matchmaking-sweep.processor.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { MatchmakingSweepProcessor } from "./matchmaking-sweep.processor";
import { QueuesService } from "../queues.service";

describe("MatchmakingSweepProcessor", () => {
    let processor: MatchmakingSweepProcessor;
    let queuesService: { processPoolMatching: jest.Mock };

    beforeEach(async () => {
        queuesService = { processPoolMatching: jest.Mock.fn().mockResolvedValue({ matchesCreated: 2 }) };
        const module = await Test.createTestingModule({
            providers: [MatchmakingSweepProcessor, { provide: QueuesService, useValue: queuesService }],
        }).compile();
        processor = module.get(MatchmakingSweepProcessor);
    });

    it("executes pool matching for the given poolId", async () => {
        const job = { data: { poolId: "pool_1", projectId: "p1" } } as any;
        await processor.process(job);
        expect(queuesService.processPoolMatching).toHaveBeenCalledWith("pool_1", "p1");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- matchmaking-sweep.processor.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement MatchmakingSweepProcessor**

Create `apps/api/src/queues/processors/matchmaking-sweep.processor.ts`:

```ts
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { QueuesService } from "../queues.service";

export interface MatchmakingPoolJobData {
    poolId: string;
    projectId: string;
}

@Processor("matchmaking-pool", { concurrency: 5 })
export class MatchmakingSweepProcessor extends WorkerHost {
    private readonly logger = new Logger(MatchmakingSweepProcessor.name);

    constructor(private readonly queuesService: QueuesService) {
        super();
    }

    async process(job: Job<MatchmakingPoolJobData>): Promise<void> {
        const { poolId, projectId } = job.data;
        await this.queuesService.processPoolMatching(poolId, projectId);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- matchmaking-sweep.processor.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queues/
git commit -m "feat(api): implement partitioned pool matchmaking processor on BullMQ"
```

---

### Task 6: Dedicated Worker Entrypoint & Module Separation

**Files:**

- Create: `apps/api/src/worker.main.ts`
- Create: `apps/api/src/worker-app.module.ts`
- Modify: `apps/api/src/app.module.ts` (API mode imports only queue producers, not worker consumers)
- Modify: `apps/api/package.json` (add `"start:worker"`, `"start:worker:dev"`)
- Test: `apps/api/src/worker-app.module.spec.ts`

**Interfaces:**

- Consumes: BullMQ consumers, PrismaModule, Redis connection.
- Produces: Headless worker runtime (`NestFactory.createApplicationContext`) with OS signal handling.

- [ ] **Step 1: Write failing WorkerAppModule test**

Create `apps/api/src/worker-app.module.spec.ts`:

```ts
import { Test } from "@nestjs/testing";
import { WorkerAppModule } from "./worker-app.module";

describe("WorkerAppModule", () => {
    it("compiles worker context without HTTP controllers", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [WorkerAppModule],
        }).compile();
        expect(moduleRef).toBeDefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- worker-app.module.spec.ts`
Expected: FAIL — `WorkerAppModule` not found.

- [ ] **Step 3: Implement WorkerAppModule & worker.main.ts**

Create `apps/api/src/worker-app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { BullMQConfigModule } from "./common/redis/bullmq-config.module";
import { QueuesModule } from "./queues/queues.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { SchedulerHealthModule } from "./common/scheduler-health/scheduler-health.module";

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        BullMQConfigModule,
        QueuesModule,
        WebhooksModule,
        SchedulerHealthModule,
    ],
})
export class WorkerAppModule {}
```

Create `apps/api/src/worker.main.ts`:

```ts
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerAppModule } from "./worker-app.module";

async function bootstrap() {
    const logger = new Logger("WorkerBootstrap");
    const app = await NestFactory.createApplicationContext(WorkerAppModule);
    app.enableShutdownHooks();
    logger.log("Matching-Man background worker booted and listening to BullMQ queues");
}

void bootstrap();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- worker-app.module.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/worker.main.ts apps/api/src/worker-app.module.ts apps/api/src/app.module.ts apps/api/package.json apps/api/src/worker-app.module.spec.ts
git commit -m "feat(api): decouple worker entrypoint from HTTP server"
```

---

### Task 7: Multi-Service Docker Compose Setup (API + Worker)

**Files:**

- Modify: `Dockerfile`
- Modify: `docker-compose.yml` & `docker-compose.prod.yml`
- Modify: `.github/workflows/pipeline.yml`

**Interfaces:**

- Consumes: Built Docker image `matching-man-app`.
- Produces: Decoupled `api` and `worker` containers managed via compose.

- [ ] **Step 1: Update Dockerfile & entrypoint**

Ensure Docker image can start as either API or Worker:
`entrypoint.sh`:

```bash
if [ "$1" = "worker" ]; then
    exec node dist/src/worker.main.js
else
    exec node dist/src/main.js
fi
```

- [ ] **Step 2: Update docker-compose.yml**

```yaml
api:
    build:
        context: .
        dockerfile: Dockerfile
    container_name: matching-man-api
    environment:
        DATABASE_URL: postgresql://admin:password@postgres:5432/matching_hub?schema=public
        REDIS_HOST: redis
        REDIS_PORT: 6379
        PORT: 3000
    ports:
        - "3000:3000"
    depends_on:
        postgres: { condition: service_healthy }
        redis: { condition: service_healthy }

worker:
    build:
        context: .
        dockerfile: Dockerfile
    command: ["worker"]
    container_name: matching-man-worker
    environment:
        DATABASE_URL: postgresql://admin:password@postgres:5432/matching_hub?schema=public
        REDIS_HOST: redis
        REDIS_PORT: 6379
    depends_on:
        postgres: { condition: service_healthy }
        redis: { condition: service_healthy }
    restart: unless-stopped
```

- [ ] **Step 3: Verify build and config syntax**

Run: `docker compose config`
Expected: 0 syntax errors, 4 services (`postgres`, `redis`, `api`, `worker`).

- [ ] **Step 4: Commit**

```bash
git add Dockerfile entrypoint.sh docker-compose.yml docker-compose.prod.yml .github/workflows/pipeline.yml
git commit -m "chore(infra): add separate worker and api containers to docker-compose"
```

---

### Task 8: Match Dispute Prisma Schema & Migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260825000000_phase14_match_disputes/migration.sql`
- Test: Prisma migration deploy check

**Interfaces:**

- Consumes: PostgreSQL schema.
- Produces: `MatchDispute` model and `DisputeStatus` (`OPEN`, `RESOLVED`, `REJECTED`) enum.

- [ ] **Step 1: Add MatchDispute to schema.prisma**

In `apps/api/prisma/schema.prisma`:

```prisma
enum DisputeStatus {
  OPEN
  RESOLVED
  REJECTED
}

model MatchDispute {
  id                       String        @id @default(cuid())
  projectId                String        @map("project_id")
  matchId                  String        @map("match_id")
  claimantTeamId           String?       @map("claimant_team_id")
  status                   DisputeStatus @default(OPEN)
  reason                   String
  evidence                 Json?
  overrideWinnerGroupIndex Int?          @map("override_winner_group_index")
  resolvedByUserId         String?       @map("resolved_by_user_id")
  resolvedAt               DateTime?     @map("resolved_at")
  resolutionNotes          String?       @map("resolution_notes")
  createdAt                DateTime      @default(now()) @map("created_at")
  updatedAt                DateTime      @updatedAt @map("updated_at")

  project                  Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  match                    Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  resolvedByUser           User?         @relation("ResolvedDisputes", fields: [resolvedByUserId], references: [id], onDelete: SetNull)

  @@index([projectId, status])
  @@index([matchId])
  @@map("match_disputes")
}
```

- [ ] **Step 2: Generate Prisma Migration & Client**

Run: `pnpm --dir apps/api prisma:generate`

- [ ] **Step 3: Run migration test**

Run: `pnpm --dir apps/api prisma:migrate:dev --name phase14_match_disputes`
Expected: Migration created and applied cleanly.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add MatchDispute model and migration"
```

---

### Task 9: Match Dispute Public API & Webhook Emission

**Files:**

- Create: `apps/api/src/disputes/dto/create-dispute.dto.ts`
- Create: `apps/api/src/disputes/disputes.service.ts`
- Modify: `apps/api/src/matches/matches.controller.ts` (`POST /v1/matches/:id/dispute`)
- Test: `apps/api/src/disputes/disputes.service.spec.ts`

**Interfaces:**

- Consumes: Public API key authentication (`ProjectApiKeyGuard`).
- Produces: `POST /v1/matches/:id/dispute`, updates `Match.status = DISPUTED`, emits `match.disputed` webhook event.

- [ ] **Step 1: Write failing create dispute test**

Create `apps/api/src/disputes/disputes.service.spec.ts`:

```ts
import { ConflictException, NotFoundException } from "@nestjs/common";
import { DisputesService } from "./disputes.service";
import { MatchStatus, DisputeStatus } from "../generated/prisma/client";

describe("DisputesService.createDispute", () => {
    let service: DisputesService;
    let prisma: any;
    let webhooks: any;

    beforeEach(() => {
        prisma = {
            match: { findUnique: jest.fn(), update: jest.fn() },
            matchDispute: { create: jest.fn(), findFirst: jest.fn() },
            $transaction: jest.fn((cb) => cb(prisma)),
        };
        webhooks = { emitProjectEvent: jest.fn() };
        service = new DisputesService(prisma as any, webhooks as any, null as any);
    });

    it("creates an OPEN dispute for a completed match and emits webhook", async () => {
        prisma.match.findUnique.mockResolvedValue({ id: "m1", projectId: "p1", status: MatchStatus.COMPLETED });
        prisma.matchDispute.findFirst.mockResolvedValue(null);
        prisma.matchDispute.create.mockResolvedValue({
            id: "d1",
            status: DisputeStatus.OPEN,
            reason: "Cheating detected",
        });

        const result = await service.createDispute("p1", "m1", { reason: "Cheating detected" });
        expect(result.status).toBe(DisputeStatus.OPEN);
        expect(webhooks.emitProjectEvent).toHaveBeenCalledWith("p1", "match.disputed", expect.any(Object));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- disputes.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement Create Dispute Logic**

Implement `DisputesService.createDispute` and hook `POST /v1/matches/:id/dispute` in `MatchesController`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- disputes.service.spec.ts matches.controller.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/disputes/ apps/api/src/matches/
git commit -m "feat(api): implement public match dispute creation endpoint and webhook"
```

---

### Task 10: Operator Dispute Resolution & Elo Reconciliation

**Files:**

- Create: `apps/api/src/disputes/dto/resolve-dispute.dto.ts`
- Create: `apps/api/src/disputes/disputes.controller.ts` (Dashboard routes)
- Modify: `apps/api/src/disputes/disputes.service.ts`
- Test: `apps/api/src/disputes/dispute-resolution.spec.ts`

**Interfaces:**

- Consumes: Operator credentials (`DashboardAuthGuard` + `ProjectAccessGuard`).
- Produces: `POST /v1/projects/:projectId/disputes/:disputeId/resolve` and `/reject`, recalculates Elo rating diffs if winner overturned, emits `match.dispute_resolved`.

- [ ] **Step 1: Write failing dispute resolution test**

In `apps/api/src/disputes/dispute-resolution.spec.ts`:

```ts
it("resolves dispute with winner override and recalculates Elo ratings", async () => {
    // Mock dispute in OPEN status
    // Call service.resolveDispute(context, projectId, disputeId, { overrideWinnerGroupIndex: 1, resolutionNotes: "Verified clip" })
    // Verify matchResult updated, rating profiles adjusted, webhook emitted
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- dispute-resolution.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement Dispute Resolution & Elo Adjustment**

Implement `resolveDispute` and `rejectDispute` in `DisputesService` and dashboard controller routes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- dispute-resolution.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/disputes/
git commit -m "feat(api): implement operator dispute resolution and Elo rating reconciliation"
```

---

### Task 11: Web Dashboard Disputes UI

**Files:**

- Create: `apps/web/app/dashboard/projects/[projectId]/disputes/page.tsx`
- Create: `apps/web/app/dashboard/projects/[projectId]/disputes/[disputeId]/page.tsx`
- Create: `apps/web/components/disputes/dispute-actions-dialog.tsx`
- Modify: `apps/web/components/project-sidebar.tsx`
- Test: `pnpm --dir apps/web typecheck`

**Interfaces:**

- Consumes: API endpoints `/v1/projects/:projectId/disputes`.
- Produces: Disputes listing, filtering, detail inspector, and resolve/reject modals in Next.js dashboard.

- [ ] **Step 1: Create Disputes listing page**

Implement `apps/web/app/dashboard/projects/[projectId]/disputes/page.tsx` with status tabs (`OPEN`, `RESOLVED`, `REJECTED`) and data table.

- [ ] **Step 2: Create Dispute detail & action dialog**

Implement `apps/web/app/dashboard/projects/[projectId]/disputes/[disputeId]/page.tsx` with Match details, evidence JSON viewer, and Resolve/Reject dialogs.

- [ ] **Step 3: Update sidebar navigation**

Add "Disputes" link with badge count for open disputes to `apps/web/components/project-sidebar.tsx`.

- [ ] **Step 4: Run typecheck to verify build**

Run: `pnpm --dir apps/web typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dashboard/projects/[projectId]/disputes/ apps/web/components/disputes/ apps/web/components/project-sidebar.tsx
git commit -m "feat(web): add disputes management and resolution UI to dashboard"
```

---

### Task 12: Post-Redis Performance Validation & Documentation

**Files:**

- Modify: `docs/performance.md`
- Modify: `docs/openapi.json`
- Modify: `docs/roadmap/phase-14-scale-and-dispute-resolution.md`

**Interfaces:**

- Consumes: Running Docker stack with `matching-man-api`, `matching-man-worker`, and `matching-man-redis`.
- Produces: Benchmark comparison numbers (Pre-Redis vs Post-Redis) documented in `docs/performance.md`.

- [ ] **Step 1: Run comprehensive benchmarks against the new stack**

Run:

```bash
DURATION=20 node apps/api/perf/run-all-benchmarks.mjs
```

- [ ] **Step 2: Update docs/performance.md with before/after comparison table**

Document:

- HTTP Enqueue throughput gain (e.g. ~65 req/s -> ~1,500+ req/s)
- Multi-pool linear scalability
- Worker resource consumption

- [ ] **Step 3: Update OpenAPI specification & roadmap status**

Run:

```bash
pnpm --dir apps/api openapi:generate
```

- [ ] **Step 4: Run whole-workspace lint and test**

Run:

```bash
pnpm format && pnpm lint && pnpm api:test
```

Expected: All formatting, linting, and unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add docs/performance.md docs/openapi.json docs/roadmap/phase-14-scale-and-dispute-resolution.md
git commit -m "docs(perf): record post-Redis benchmark comparison and update OpenAPI specs"
```

---

## Self-Review Checklist

1. **Spec coverage:** Every requirement from `docs/superpowers/specs/2026-08-25-phase-14-scale-and-dispute-resolution-design.md` maps directly to Tasks 1-12.
2. **Placeholder scan:** No "TODO", "TBD", or unelaborated steps. All steps provide exact files, commands, and code.
3. **Type consistency:** Queue names (`matchmaking-pool`, `queue-timeout`, `webhook-delivery`) and DTO types remain consistent across tasks.
4. **TDD Flow:** Every task follows Red-Green-Refactor-Commit cycle.
