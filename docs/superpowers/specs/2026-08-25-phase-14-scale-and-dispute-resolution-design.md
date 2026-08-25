# Phase 14: Scale, Redis & BullMQ Queue Migration, and Dispute Resolution — Design

## Status

- [x] Approved / Planned

## Objective

Elevate the matchmaking platform's throughput and operational robustness by:

1. Migrating background execution from interval-based database polling (`@nestjs/schedule`) to a distributed Redis-backed job queue (**BullMQ**).
2. Decoupling the public HTTP API from background worker execution (**Process Separation**).
3. Eliminating row-lock contention across concurrent pools through **Partitioned Pool Queues**.
4. Introducing an end-to-end **Match Dispute Resolution Workflow** with operator audit and Elo rating reconciliation.

Graduated from `docs/roadmap/backlog.md` ("Optional Redis and BullMQ adoption", "Separation of public API from worker processes", "Partitioned pool processing", "Dispute states — manual resolution").

---

## 1. Background & Baseline Constraints

Performance benchmarks conducted on the pre-Redis architecture (`apps/api/perf/run-all-benchmarks.mjs` against Docker PostgreSQL) revealed:

- **HTTP Raw Ceiling:** `GET /health` handles **~2,075 req/sec** at 23.6ms latency.
- **Single-Pool Contention:** `POST /v1/queues/enqueue` tops out at **~65 req/sec** and **~34 matches/sec**. Increasing concurrency (from 10 to 100) only inflates latency (142ms -> 1,537ms) due to `FOR UPDATE SKIP LOCKED` row-lock serialization on the `queue_entries` table.
- **Connection Pool Bottleneck:** Multi-pool concurrent throughput is throttled at ~65 aggregate req/sec because all pools share Prisma's default `max: 3` connection pool.

**Target for Phase 14:**

- HTTP Enqueue requests write directly to Redis Stream / BullMQ Producer queue with non-blocking confirmation.
- Background worker processes match pools in isolated in-memory batches, reducing PostgreSQL locks to bulk-insert operations.
- Process separation allows HTTP API containers and Matchmaking Worker containers to scale independently.

---

## 2. Architecture & Queue Topology

### 2.1 Redis & BullMQ Queues

| Queue Name         | Job Type          | Producer                                 | Consumer                    | Strategy                                                                                                        |
| :----------------- | :---------------- | :--------------------------------------- | :-------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `matchmaking-pool` | `sweep-pool`      | `QueuesService.enqueue` / fallback timer | `MatchmakingSweepProcessor` | Debounced per `poolId` (Job ID = `pool:<poolId>`, delay = 50ms) to batch concurrent enqueues.                   |
| `queue-timeout`    | `check-timeout`   | `QueuesService.enqueue`                  | `QueueTimeoutProcessor`     | Delayed BullMQ job scheduled for `now + gameMode.timeoutSeconds`. Replaces interval table scans.                |
| `webhook-delivery` | `deliver-webhook` | `MatchesService` / `QueuesService`       | `WebhookDeliveryProcessor`  | BullMQ backoff retry with intervals `[0s, 30s, 5m, 30m, 2h]` with dead-letter auditing in `webhook_deliveries`. |

### 2.2 Process Separation

Two distinct startup binaries compiled from `apps/api`:

1. **API Service (`apps/api/src/main.ts`)**:
    - Boots Fastify/Express HTTP server, Helmet, CORS, Swagger OpenAPI (`/v1/docs`), Throttler, and REST controllers.
    - Injects BullMQ **Producers** (adds jobs to Redis queues).
    - Does NOT register BullMQ **Workers** (consumes no background CPU).
2. **Worker Service (`apps/api/src/worker.main.ts`)**:
    - Boots a headless NestJS application context (`NestFactory.createApplicationContext(WorkerAppModule)`).
    - Injects PrismaService, Redis connection, and registers all BullMQ **Consumers/Processors**.
    - Listens to OS signals (`SIGTERM`, `SIGINT`) for graceful job completion and shutdown.

### 2.3 Docker Deployment Topology

- `docker-compose.yml` & `docker-compose.prod.yml` updated with:
    - `postgres` (`matching-man-db`): PostgreSQL 17.
    - `redis` (`matching-man-redis`): Redis 7-alpine with append-only persistence.
    - `api` (`matching-man-api`): runs `node dist/src/main.js` on port 3000.
    - `worker` (`matching-man-worker`): runs `node dist/src/worker.main.js` with restart policy.

---

## 3. Dispute Resolution Workflow

### 3.1 Data Model (`prisma/schema.prisma`)

```prisma
enum DisputeStatus {
  OPEN
  RESOLVED
  REJECTED
}

model MatchDispute {
  id                      String        @id @default(cuid())
  projectId               String        @map("project_id")
  matchId                 String        @map("match_id")
  claimantTeamId          String?       @map("claimant_team_id")
  status                  DisputeStatus @default(OPEN)
  reason                  String
  evidence                Json?
  overrideWinnerGroupIndex Int?         @map("override_winner_group_index")
  resolvedByUserId        String?       @map("resolved_by_user_id")
  resolvedAt              DateTime?     @map("resolved_at")
  resolutionNotes         String?       @map("resolution_notes")
  createdAt               DateTime      @default(now()) @map("created_at")
  updatedAt               DateTime      @updatedAt @map("updated_at")

  project                 Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  match                   Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  resolvedByUser          User?         @relation("ResolvedDisputes", fields: [resolvedByUserId], references: [id], onDelete: SetNull)

  @@index([projectId, status])
  @@index([matchId])
  @@map("match_disputes")
}
```

### 3.2 Public Game Server & Operator APIs

1. **Raise Dispute (Game Server / Player):**
    - `POST /v1/matches/:id/dispute`
    - Headers: `Authorization: Bearer <projectApiKey>`
    - Body: `{ claimantTeamId?: string, reason: string, evidence?: Record<string, unknown> }`
    - State transition: Sets `Match.status = DISPUTED`.
    - Webhook emitted: `match.disputed`.

2. **List & View Disputes (Dashboard Operator):**
    - `GET /v1/projects/:projectId/disputes?status=OPEN`
    - `GET /v1/projects/:projectId/disputes/:disputeId`
    - Security: `DashboardAuthGuard` + `ProjectAccessGuard`.

3. **Resolve Dispute (Dashboard Operator):**
    - `POST /v1/projects/:projectId/disputes/:disputeId/resolve`
    - Body: `{ overrideWinnerGroupIndex?: number | null, resolutionNotes: string }`
    - Actions:
        - Sets dispute status to `RESOLVED`.
        - Updates `Match.status = COMPLETED`.
        - Updates `MatchResult` with corrected outcome.
        - Recalculates Elo ratings if original outcome was altered (applies differential adjustment).
        - Webhook emitted: `match.dispute_resolved`.

4. **Reject Dispute (Dashboard Operator):**
    - `POST /v1/projects/:projectId/disputes/:disputeId/reject`
    - Body: `{ resolutionNotes: string }`
    - Actions: Sets dispute status to `REJECTED`, returns match to previous state.

---

## 4. Frontend Admin Experience (`apps/web`)

- Add **Disputes** to sidebar navigation under Project scope.
- `apps/web/app/dashboard/projects/[projectId]/disputes/page.tsx`:
    - Filter by status (`OPEN`, `RESOLVED`, `REJECTED`).
    - Table showing match ID, game mode, claimant team, reason snippet, creation time, status badge.
- `apps/web/app/dashboard/projects/[projectId]/disputes/[disputeId]/page.tsx`:
    - Detailed view: Match slots and player roster, original result vs claim.
    - JSON evidence viewer.
    - Action modal to Resolve (select new winner or declare draw/void) or Reject with required resolution notes.

---

## 5. Testing & Verification

1. **Unit & Module Tests**:
    - `matchmaking-sweep.processor.spec.ts`: verifies debounced per-pool sweep trigger.
    - `webhook-delivery.processor.spec.ts`: verifies exponential backoff retry.
    - `match-disputes.service.spec.ts`: verifies dispute state machine, permissions, and Elo rollback.
2. **E2E Integration Tests**:
    - `enqueue-worker.e2e-spec.ts`: validates enqueue -> Redis queue -> worker process -> match created.
    - `dispute-resolution.e2e-spec.ts`: validates match result report -> dispute -> operator resolve -> rating update.
3. **Performance Benchmark**:
    - Run `apps/api/perf/run-all-benchmarks.mjs` against the separated Redis + Worker stack and record before/after comparison in `docs/performance.md`.
