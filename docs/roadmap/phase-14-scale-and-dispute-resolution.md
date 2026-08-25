# Phase 14: Performance, Redis/BullMQ Scaling & Dispute Resolution

## Status

- [x] Complete

## Objective

Elevate the platform's throughput and operational robustness by migrating from in-process scheduled polling to a distributed job queue (**Redis & BullMQ**), decoupling the public API from background workers (**Process Separation**), optimizing concurrent pool throughput (**Partitioned Pool Processing**), and introducing a comprehensive **Dispute Resolution Workflow** for contested match results.

Graduated from:

- Backlog: Scale and Operations (_"Optional Redis and BullMQ adoption"_, _"Separation of public API from worker processes"_, _"Partitioned pool processing"_)
- Backlog: Advanced Matchmaking (_"Dispute states — manual resolution beyond the existing DISPUTED match status"_)

---

## Stages

### Stage 1 — Redis & BullMQ Queue Migration

Transition background jobs (matchmaking sweeps, queue timeouts, webhook retries) from database polling and in-process `@nestjs/schedule` to Redis-backed BullMQ queues.

- [x] Add Redis container definition to `docker-compose.yml` and production setup.
- [x] Install `@nestjs/bullmq` & `bullmq` in `apps/api`.
- [x] Create `QueuesModule` BullMQ producers and consumers for:
    - `matchmaking-sweep`: Triggered per active pool with debounce/throttling.
    - `queue-timeout`: Delayed jobs per queue entry instead of interval table scans.
    - `webhook-delivery`: BullMQ worker managing retry delays `[0s, 30s, 5m, 30m, 2h]` with built-in dead-letter handling.
- [x] Maintain DB durability: Keep Postgres tables as audit trail and source of truth while BullMQ manages execution orchestration.
- [x] Add graceful fallback or health checks for Redis connectivity (`/v1/health` check enrichment).

**Exit criteria:** Webhook retries and queue sweeps run through BullMQ workers without polling overhead on PostgreSQL.

---

### Stage 2 — Process Separation (API vs Worker)

Decouple HTTP request handling from background job execution to enable independent scaling.

- [x] Add a dedicated worker entry point (`apps/api/src/worker.main.ts` or CLI flag `--mode=worker`) that boots only Prisma, Redis, and BullMQ consumers.
- [x] Configure `apps/api/src/main.ts` as pure HTTP/REST (controllers, guards, validation, OpenAPI).
- [x] Update `Dockerfile` with multi-stage targets or configurable start commands (`CMD ["node", "dist/src/main"]` vs `CMD ["node", "dist/src/worker.main"]`).
- [x] Update `docker-compose.yml` and `docker-compose.prod.yml` to define separate `api` and `worker` services.
- [x] Verify GitHub Actions CI/CD builds and deploys both services cleanly.

**Exit criteria:** API server can crash or be scaled to N instances without affecting job scheduling, and worker processing cannot starve HTTP request threads.

---

### Stage 3 — Pool Partitioning & Concurrency Optimization

Overcome the measured single-pool row-lock ceiling (~65 enq/s) by isolating concurrent pools and optimizing connection pooling.

- [x] **Partitioned Pool Queues:** Route matchmaking triggers to pool-specific BullMQ queues or job keys so distinct pools match concurrently without cross-pool contention.
- [x] **Connection Tuning:** Expose configurable Prisma connection pool size (`DATABASE_URL` connection limit + PgBouncer compatibility if needed).
- [x] **Benchmark Validation:** Re-run `apps/api/perf/enqueue-load.mjs` across multiple concurrent pools and update [`docs/performance.md`](../performance.md) with new multi-pool throughput numbers.

**Exit criteria:** Multi-pool throughput scales linearly with the number of pools rather than bottlenecking on a shared lock.

---

### Stage 4 — Dispute Resolution Workflow

Provide game servers and operators with an end-to-end mechanism to contest, review, and manually resolve match outcomes.

- [x] **Database & Prisma Schema:**
    - Create `MatchDispute` model:
        - Fields: `id`, `matchId`, `status` (`OPEN`, `RESOLVED`, `REJECTED`), `reason`, `evidence` (Json), `claimantTeamId`, `resolvedByUserId`, `resolvedAt`, `resolutionNotes`, `overrideWinnerGroupIndex`.
        - Relationship to `Match`, `Project`, and `User`.
- [x] **API Endpoints (Game Server & Public API):**
    - `POST /v1/matches/:id/dispute` (Raise dispute with reason/evidence; sets `Match.status = DISPUTED`).
    - Webhook event: Emit `match.disputed` to subscribed webhook endpoints.
- [x] **Rating Engine Reconciliation:**
    - Support Elo rating rollback or recalculation when a dispute overrides the original winner.
    - Record audit entries in `RatingHistory` with resolution metadata.
- [x] **Dashboard UI (Operator Workflow):**
    - Project navigation item: **Disputes**.
    - Dispute listing with filtering (`OPEN`, `RESOLVED`, `REJECTED`).
    - Dispute detail modal/page: view match slots, reported results, submitted evidence, and reason.
    - Action buttons: "Resolve Dispute" (select actual winner or declare void) & "Reject Dispute" (uphold original result) with required operator notes.
    - Webhook event: Emit `match.dispute_resolved` on resolution.

**Exit criteria:** Contested matches can be raised via API, inspected and resolved via dashboard, with Elo ratings and webhooks adjusted accordingly.

---

## Deliverables & Testing

- Unit tests for BullMQ processors, dispute state machine, and Elo dispute recalculation.
- E2e tests for:
    - Enqueue → BullMQ matchmaking job → match created.
    - Report result → Dispute created → Operator resolves dispute → Elo updated & webhook emitted.
- Updated documentation in `docs/architecture.md`, `docs/api-spec-v1.md`, and `docs/performance.md`.
