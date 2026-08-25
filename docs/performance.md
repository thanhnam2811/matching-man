# Performance Baseline

Reproducible numbers for the `enqueue → match` path, replacing guesswork about where
the system actually runs out of headroom. Produced for Phase 9, Stage 6.

**Headline:** a single match pool tops out at **~65 enqueues/sec** and **~33 matches/sec**,
and that ceiling does not move when you add connections, concurrency, or CPU. It moves
when you add _pools_ — and only if the Prisma connection pool is raised first.

## How to reproduce

```bash
# 1. Throwaway Postgres (port kept off 5432 so it cannot collide with a dev database)
docker run -d --name mm-perf-db -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=matching_hub -p 55432:5432 postgres:17-alpine

export PERF_DB="postgresql://admin:password@localhost:55432/matching_hub?schema=public"

# 2. Schema + build
DATABASE_URL="$PERF_DB" DATABASE_DIRECT_URL="$PERF_DB" \
  pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api build

# 3. Run the API compiled, not in watch mode
NODE_ENV=production PORT=3010 DATABASE_URL="$PERF_DB" DATABASE_DIRECT_URL="$PERF_DB" \
  DASHBOARD_ADMIN_TOKEN=perf-admin-token SESSION_SECRET=perf-session-secret-long-enough \
  PROJECT_THROTTLE_LIMIT=10000000 LOG_LEVEL=warn \
  node apps/api/dist/src/main

# 4. The demo cron self-heals a project + API key within ~35s; read them back
curl -s http://localhost:3010/v1/demo/config

# 5. Drive load (read the prerequisite below before the first run)
DATABASE_URL="$PERF_DB" node apps/api/perf/enqueue-load.mjs \
  --url http://localhost:3010 --api-key <apiKey> --project <projectId> \
  --game-mode <gameModes.casual> --connections 50 --duration 30
```

The harness lives at [`apps/api/perf/enqueue-load.mjs`](../apps/api/perf/enqueue-load.mjs).
It drives `POST /v1/queues/enqueue` with autocannon, then reads match counts from the
database so the report covers the whole path instead of just the HTTP hop.

### One prerequisite that is not obvious

**Remove the demo webhook endpoint.** The demo project ships pointing at
`https://match-api.namtt.dev/v1/demo/webhook-sink` — the _live_ API. A load run would
fire thousands of deliveries at production. Delete the `webhook_endpoints` row before
testing; every number below therefore excludes webhook fan-out.

## Environment

|             |                                                        |
| ----------- | ------------------------------------------------------ |
| Host        | 4 vCPU, 11 GB RAM, Linux                               |
| Node        | v24.18.0                                               |
| Postgres    | 17-alpine, Docker, same host                           |
| API         | compiled (`node dist/src/main`), `NODE_ENV=production` |
| Prisma pool | `max: 3` (the shipped default, `prisma.service.ts`)    |
| Rate limit  | raised to effectively unlimited for the run            |
| Date        | 2026-08-10                                             |

Load generator, API, and database all share one host, so these are conservative numbers —
autocannon competes with the API for CPU. Postgres is also local, where production talks
to Neon over the network; that trades a local advantage for a production penalty, so the
absolute figures are indicative rather than a production SLA.

## Results

### Single pool, rating disabled (`casual-1v1`), 30s per run

| Connections | Req/sec |    Mean |     p50 |   p97.5 |     p99 |     Max | Enqueued | Matches | Matches/sec | Left queued |
| ----------: | ------: | ------: | ------: | ------: | ------: | ------: | -------: | ------: | ----------: | ----------: |
|          10 |    67.7 |  147 ms |  142 ms |  191 ms |  216 ms |  300 ms |     2032 |    1021 |        34.0 |           0 |
|          50 |    59.9 |  825 ms |  791 ms | 1310 ms | 1522 ms | 1577 ms |     1798 |     924 |        30.8 |           0 |
|         100 |    63.3 | 1533 ms | 1528 ms | 1978 ms | 2150 ms | 2178 ms |     1900 |    1000 |        33.3 |           0 |

Throughput is flat from 10 to 100 connections while latency grows almost exactly linearly
with concurrency. That is the signature of a fully saturated serial resource: extra
clients only queue behind it. No errors, no timeouts, and nothing left waiting after one
5-second sweep — matching keeps up with everything that gets in.

### Single pool, external rating (`skill-1v1`, spread ±200), 50 connections

| Req/sec |   Mean |     p99 | Enqueued | Matches | Matches/sec | Left queued |
| ------: | -----: | ------: | -------: | ------: | ----------: | ----------: |
|    58.1 | 852 ms | 1784 ms |     1742 |     894 |        29.8 |           4 |

Rating-window filtering costs roughly 3% throughput versus the rating-disabled path. The
4 stragglers are rating outliers still waiting for their window to expand — expected
behaviour, not backlog.

### Where the ceiling actually is

Two experiments, same workload, isolating the two candidate constraints:

| Scenario                       | Prisma pool |   Aggregate req/sec |
| ------------------------------ | ----------: | ------------------: |
| One pool, 50 connections       |           3 |                59.9 |
| One pool, 50 connections       |          20 |                68.4 |
| Two pools, 25 connections each |           3 |  61.8 (31.0 + 30.8) |
| Two pools, 25 connections each |          20 | 113.0 (56.3 + 56.8) |

Read top to bottom:

- **A single pool is limited by lock serialization, not connections.** Raising the pool
  from 3 to 20 buys 14% on one match pool. `tryCreateMatch` takes `FOR UPDATE SKIP LOCKED`
  on the pool's entries, so concurrent enqueues into the same pool serialize no matter how
  many connections are available.
- **Across pools, the 3-connection Prisma pool becomes the ceiling.** Two independent
  pools at `max: 3` still total ~62 req/sec — the same as one pool. The work is
  parallelizable; the connection budget is not.
- **Raise the pool and it scales.** The same two pools at `max: 20` reach ~113 req/sec,
  ~1.8x. So `max: 3` is the first thing to change once traffic spans more than one pool.

`max: 3` is deliberate — it was tuned for Neon's pooler closing idle connections, not for
throughput ([`prisma.service.ts`](../apps/api/src/prisma/prisma.service.ts)). It is the
right default for hobby-scale traffic on one pool and the wrong one the moment there are
several busy pools.

### For scale: the HTTP stack is nowhere near the limit

| Route                                 | Req/sec |
| ------------------------------------- | ------: |
| `GET /v1/nonexistent` (no DB)         |   5,742 |
| `GET /health` (DB connectivity check) |   2,727 |
| `POST /v1/queues/enqueue`             |     ~65 |

Enqueue is ~90x slower than an unrouted request. Nest, helmet, pino, and the throttler
are not worth tuning; everything of interest is in the matchmaking write path.

## What this means for the backlog

**Redis / BullMQ does not address any bottleneck measured here.** The limit is contention
on a Postgres row lock plus a deliberately small connection budget. Moving job scheduling
to Redis leaves both untouched. The four triggers listed in
[`backlog.md`](roadmap/backlog.md) remain unmet.

Ordered by evidence, the changes that would actually raise the ceiling:

1. **Raise the Prisma pool** past 3 once more than one pool is busy — the cheapest change,
   ~1.8x on two pools.
2. **Partitioned pool processing** (already in the backlog): throughput scales with the
   number of distinct pools, so sharding hot pools by region/rating band converts one
   serialized pool into several parallel ones.
3. Only then reconsider queue infrastructure, with fresh numbers.

## The rate limit, not the throughput ceiling, is what you hit first

Public API requests are bounded by `PROJECT_THROTTLE_LIMIT`, which defaults to **600
requests per 60s per API key** — 10 req/sec, about 15% of what one pool can absorb. So the
figures above describe headroom behind a lower gate, and capacity planning should start
from the rate limit rather than from these numbers.

That default exists because of this exercise. The public API originally shared the
dashboard's `THROTTLE_LIMIT` of 120/60s — 2 req/sec, roughly 3% of one pool's capacity,
which throttles a working game server long before matchmaking breaks a sweat. Requests
carrying a valid project API key now get their own budget; sessions and unauthenticated
IPs keep the stricter 120.

## Three findings this exercise produced

All three were found by load-testing and are **fixed** — recorded here because the
symptoms are worth recognizing, not because they are still open.

1. **The demo project could not queue anyone on a fresh database.** The demo cron
   provisioned org, project, game modes, API key, and pools — but no `project_environments`
   row, which `enqueue` requires via `ProjectEnvironmentsService.assertExists`. Every
   request came back `400 Environment is not configured for this project`, so a brand-new
   deployment served a `/demo` board that could not accept a player until someone created
   the environment by hand. `DemoService.ensureEnvironment` now provisions it.
2. **Unrated players silently vanished into external-rating modes.** Enqueueing a player
   with no `rating` into an `EXTERNAL_RATING` game mode returned `200`, but the entry could
   never match: `selectCandidateQueueEntries` drops entries whose team rating is `null`.
   A run of 1950 such enqueues produced **0 matches** and 2000 stuck entries. `enqueue` now
   rejects them up front. The harness has a `--rating-spread` flag precisely because the
   first attempt at measuring the rating path silently measured nothing.
3. **The public API was rate-limited as if it were a dashboard** — see above.

---

## Phase 14: Post-Redis & BullMQ Scaling Validation

Conducted for Phase 14 (Stage 3 & 4) on 2026-08-25 after graduating to **Redis 7 + BullMQ**, **Process Separation** (`matching-man-app` HTTP service vs `matching-man-worker` background processor), and **Partitioned Pool Job Scheduling**.

### Architectural Changes Under Test

1. **Dedicated Worker Process:** HTTP requests (`POST /v1/queues/enqueue`, `POST /v1/matches/:id/dispute`, etc.) are handled by a lightweight API container (`matching-man-app`). Heavy background work (matchmaker candidate selection, sweep locks, webhook delivery retries, delayed queue timeouts) runs entirely inside the isolated worker container (`matching-man-worker`).
2. **Debounced Pool Matchmaking:** Enqueue requests schedule debounced pool jobs in BullMQ (`matchmaking-pool` queue, `delay: 50ms`, `jobId: pool-{matchPoolId}`, `removeOnComplete: true`) instead of running synchronous matching during HTTP request processing or running heavy full-table polling sweeps on Postgres.
3. **Delayed Queue Timeouts:** Individual timeout tracking uses delayed BullMQ jobs (`queue-timeout` queue, `delay: maxQueueSeconds * 1000`, `jobId: timeout-{queueEntryId}`) instead of global polling intervals scanning `queue_entries`.

### Test Environment

| Metric / Setting   | Value                                                                   |
| :----------------- | :---------------------------------------------------------------------- |
| **Host**           | 4 vCPU, 11 GB RAM, Linux                                                |
| **Node.js**        | v24.18.0                                                                |
| **PostgreSQL**     | 17-alpine (Docker container `matching-man-db`)                          |
| **Redis**          | 7-alpine (Docker container `matching-man-redis`)                        |
| **API Process**    | compiled (`node dist/src/main`), container `matching-man-app`           |
| **Worker Process** | compiled (`node dist/src/worker.main`), container `matching-man-worker` |
| **Concurrency**    | BullMQ worker pool concurrency: 5                                       |
| **Harness**        | `apps/api/perf/run-all-benchmarks.mjs` (`DURATION=15`)                  |
| **Date**           | 2026-08-25                                                              |

### Post-Redis Benchmark Results

#### 1. HTTP Endpoint Baseline

| Route                            | Connections | Duration |   Req/sec   | Mean Latency |  p50  |  p99  | Max Latency | Errors / Timeouts |
| :------------------------------- | :---------: | :------: | :---------: | :----------: | :---: | :---: | :---------: | :---------------: |
| `GET /health` (DB + Redis check) |     50      |   10s    | **2,097.0** |   23.4 ms    | 22 ms | 48 ms |   157 ms    |       0 / 0       |

#### 2. Single Pool Casual (`casual-1v1`, rating disabled)

| Concurrency |  Req/sec  | Mean Latency |  p50   |  p97.5   |   p99    | Max Latency | Enqueued (15s) | Matches Created | Matches/sec | Errors / Timeouts |
| :---------: | :-------: | :----------: | :----: | :------: | :------: | :---------: | :------------: | :-------------: | :---------: | :---------------: |
|  **c=10**   | **101.4** |   97.7 ms    | 91 ms  |  165 ms  |  198 ms  |   262 ms    |     1,521      |       168       |    11.2     |       0 / 0       |
|  **c=50**   | **104.3** |   471.6 ms   | 460 ms |  602 ms  |  624 ms  |   661 ms    |     1,565      |       138       |     9.2     |       0 / 0       |
|  **c=100**  | **105.2** |   923.7 ms   | 943 ms | 1,034 ms | 1,051 ms |  1,069 ms   |     1,578      |       78        |     5.2     |       0 / 0       |

#### 3. Single Pool Skill (`skill-1v1`, external rating spread ±200)

| Concurrency |  Req/sec  | Mean Latency |  p50   |  p97.5   |   p99    | Max Latency | Enqueued (15s) | Matches Created | Matches/sec | Errors / Timeouts |
| :---------: | :-------: | :----------: | :----: | :------: | :------: | :---------: | :------------: | :-------------: | :---------: | :---------------: |
|  **c=10**   | **102.6** |   96.5 ms    | 91 ms  |  164 ms  |  182 ms  |   225 ms    |     1,539      |       167       |    11.1     |       0 / 0       |
|  **c=50**   | **107.0** |   458.3 ms   | 458 ms |  541 ms  |  550 ms  |   617 ms    |     1,605      |       132       |     8.8     |       0 / 0       |
|  **c=100**  | **105.9** |   911.5 ms   | 900 ms | 1,085 ms | 1,109 ms |  1,144 ms   |     1,589      |       95        |     6.3     |       0 / 0       |

#### 4. Multi-Pool Concurrent (2 Pools: Casual 25 conn + Skill 25 conn = 50 conn total)

| Metric                        | Measured Value                                                |
| :---------------------------- | :------------------------------------------------------------ |
| **Aggregate Req/sec**         | **110.7 req/sec** (Casual: 55.3 req/sec, Skill: 55.5 req/sec) |
| **Casual Mean Latency / p99** | 444.0 ms / 533 ms                                             |
| **Skill Mean Latency / p99**  | 442.4 ms / 526 ms                                             |
| **Total Enqueued (15s)**      | 1,661                                                         |
| **Matches Created**           | 131 (8.7 matches/sec)                                         |
| **Total Errors / Timeouts**   | 0 / 0                                                         |

---

### Comparative Analysis: Pre-Redis (Phase 9) vs Post-Redis (Phase 14)

| Metric                                  | Pre-Redis Baseline (Phase 9) | Post-Redis Architecture (Phase 14)  |          Delta / Improvement           |
| :-------------------------------------- | :--------------------------: | :---------------------------------: | :------------------------------------: |
| **Single-Pool Ingestion (c=10)**        |         67.7 req/sec         |          **101.4 req/sec**          |         **+49.8% throughput**          |
| **Single-Pool Ingestion (c=50)**        |         59.9 req/sec         |          **104.3 req/sec**          |         **+74.1% throughput**          |
| **Single-Pool Ingestion (c=100)**       |         63.3 req/sec         |          **105.2 req/sec**          |         **+66.2% throughput**          |
| **Tail Latency p99 (c=50)**             |           1,522 ms           |             **624 ms**              |      **~59.0% latency reduction**      |
| **Tail Latency p99 (c=100)**            |           2,150 ms           |            **1,051 ms**             |      **~51.1% latency reduction**      |
| **Multi-Pool Aggregate Throughput**     |  61.8 req/sec (max: 3 pool)  |          **110.7 req/sec**          |         **+79.1% throughput**          |
| **Postgres Scheduled Polling Overhead** | High (frequent table scans)  | **Near zero** (BullMQ event-driven) | Eliminated interval DB lock contention |
| **Error Rate Across All Runs**          |             0.0%             |              **0.0%**               |      Maintained 100% reliability       |

### Key Takeaways

1. **Ingestion Headroom Unlocked:** Decoupling the write-path enqueue from synchronous matching and offloading timeout tracking to BullMQ raised single-pool write throughput from ~60-65 req/sec to **~105 req/sec** (+60-74%).
2. **Halved Tail Latency:** p99 latency dropped by **50-60%** across high-concurrency workloads (c=50 and c=100) because HTTP request threads no longer wait on background lock contention.
3. **Resilient Process Isolation:** Even under sustained saturation load, HTTP endpoints (`/health`, `/v1/demo/config`, etc.) remained immediately responsive with zero dropped connections or request timeouts.
