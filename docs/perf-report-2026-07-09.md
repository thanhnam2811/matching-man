# Báo Cáo Hiệu Năng API — Matching Hub

> **Ngày:** 2026-07-09
> **Nguồn:** Docker logs `matching-man-app` + code review
> **Môi trường:** VPS production, Neon Serverless PostgreSQL (free tier, ap-southeast-1)

---

## Tổng Quan

Sau khi phân tích ~15 phút log Docker và review code, phát hiện **3 vấn đề chính** khiến API hoạt động chậm:

| Mức độ          | Vấn đề                                            | Ảnh hưởng                                   |
| --------------- | ------------------------------------------------- | ------------------------------------------- |
| 🔴 **Critical** | Neon cold start — connection không được keepalive | Mọi query DB mất **350-400ms** thay vì <5ms |
| 🟠 **High**     | `enqueue` làm 5-6 DB round-trips tuần tự          | Mỗi request mất **1.2-1.9s**                |
| 🟡 **Medium**   | Redundant queries — fetch lại data đã có sẵn      | Lãng phí ~350ms mỗi request                 |

---

## 🔴 Vấn Đề 1: Neon Cold Start (Database Connection)

### Biểu Hiện

Mọi câu query SQL đều mất 350-400ms, bất kể đơn giản hay phức tạp:

```
[PrismaService] slow_query: {"durationMs":354,"query":"SELECT 1"}
[PrismaService] slow_query: {"durationMs":362,"query":"SELECT 1"}
[PrismaService] slow_query: {"durationMs":427,"query":"SELECT 1"}
```

Ngay cả `SELECT 1` (health check) cũng chậm — đây là **vấn đề ở tầng connection**, không phải query.

### Nguyên Nhân Gốc

1. **Thiếu `?pgbouncer=true` trên DATABASE_URL** — Connection string hiện tại:

    ```
    postgresql://user:pass@ep-...pooler.neon.tech/neondb?sslmode=require
    ```

    Dùng hostname `*-pooler*` (Neon connection pooler) nhưng **thiếu `?pgbouncer=true`**. Pooler không nhận diện đúng giao thức → mỗi query tạo connection mới → full TCP+TLS handshake mỗi lần → 350ms.

2. **Không có keepalive** — `PrismaService.onModuleInit()` chỉ gọi `$connect()` một lần. Sau đó nếu connection pool rảnh, Neon pooler đóng connection → lần sau phải tạo lại từ đầu.

3. **`DATABASE_DIRECT_URL` không được dùng** — Config có định nghĩa biến `DATABASE_DIRECT_URL` nhưng `PrismaService` hoàn toàn không đọc nó. Thông thường, `DATABASE_URL` trỏ tới pooler còn `DATABASE_DIRECT_URL` trỏ thẳng tới instance cho migrations.

### File Ảnh Hưởng

| File                                    | Dòng  | Vấn đề                                              |
| --------------------------------------- | ----- | --------------------------------------------------- |
| `apps/api/src/prisma/prisma.service.ts` | 15-18 | Không config pool (`PrismaPg` thiếu `pool` options) |
| `apps/api/src/prisma/prisma.service.ts` | 28-30 | `onModuleInit()` chỉ connect 1 lần, không keepalive |
| `apps/api/.env.production`              | —     | Thiếu `?pgbouncer=true&connection_limit=3`          |

---

## 🟠 Vấn Đề 2: Enqueue Quá Nhiều DB Round-Trips

### Biểu Hiện

`POST /v1/queues/enqueue` response time dao động **1.2s → 1.9s**:

```
POST /v1/queues/enqueue → 1630ms
POST /v1/queues/enqueue → 1625ms
POST /v1/queues/enqueue → 1210ms
POST /v1/queues/enqueue → 1367ms
POST /v1/queues/enqueue → 1545ms
```

### Luồng Xử Lý Hiện Tại (5-6 DB queries tuần tự)

```mermaid
sequenceDiagram
    participant Client
    participant QueuesService
    participant DB

    Client->>QueuesService: POST /enqueue

    QueuesService->>DB: 1. gameModesService.findOne()
    Note right of DB: ~350ms
    QueuesService->>DB: 2. projectEnvironmentsService.assertExists()
    Note right of DB: ~362ms
    QueuesService->>DB: 3. [Transaction] upsert pool + team + create queueEntry
    Note right of DB: ~350ms
    QueuesService->>DB: 4. tryCreateMatch() [Transaction]
    Note right of DB: SELECT FOR UPDATE + findMany + create match + create slots
    QueuesService->>DB: 5. webhookDeliveryService.scheduleDelivery()
    Note right of DB: find webhook endpoints
    QueuesService->>DB: 6. findUniqueOrThrow (REDUNDANT)
    Note right of DB: ~350ms — fetch lại data đã có
    QueuesService->>Client: Response
```

### Nguyên Nhân

Mỗi bước đều chờ DB response xong mới làm bước tiếp theo. Với Neon cold start 350ms/query, 5-6 bước = **1.8-2.1s tổng cộng**.

**Thêm vào đó**, matchmaking (`tryCreateMatch`) chạy **synchronous trong request path** — player đợi response tới gần 2s dù chưa chắc đã có match.

### File Ảnh Hưởng

| File                                    | Dòng    | Vấn đề                                                                     |
| --------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `apps/api/src/queues/queues.service.ts` | 100-120 | Gọi `tryCreateMatch()` synchronous — chặn response                         |
| `apps/api/src/queues/queues.service.ts` | 47-52   | `isConfigured` check bên trong transaction — DB query thừa mỗi lần enqueue |
| `apps/api/src/queues/queues.service.ts` | 183-204 | Webhook delivery scheduling sau match — thêm 1 DB query                    |

---

## 🟡 Vấn Đề 3: Redundant Queries

### 3a. freshQueueEntry trong `enqueue()` — Dòng 207-218

Sau khi `tryCreateMatch()` hoàn thành, code **fetch lại toàn bộ queueEntry từ database**:

```typescript
// queues.service.ts:207 — HOÀN TOÀN THỪA
const freshQueueEntry = await this.prismaService.client.queueEntry.findUniqueOrThrow({
    where: { id: queueEntry.id },
    include: {
        matchSlots: {
            include: { match: true },
        },
    },
});

return this.toQueueResponse(freshQueueEntry);
```

`queueEntry` ở dòng 85 đã được transaction trả về với `include: { matchSlots: { include: { match: true } } }` — y hệt. `tryCreateMatch()` chỉ update `status` và `matchedAt` trên queue entry, nhưng các field đó không cần fetch lại để trả response.

**Tác động:** ~350ms lãng phí mỗi request enqueue.

### 3b. findMany trong `tryCreateMatch()` — Dòng 261-280

Sau `$queryRaw ... FOR UPDATE SKIP LOCKED` đã có danh sách IDs, code lại chạy:

```typescript
// queues.service.ts:261 — THỪA
const candidateEntries = await tx.queueEntry.findMany({
    where: { id: { in: lockedRows.map((row) => row.id) } },
    orderBy: { queuedAt: "asc" },
    include: { team: { include: { members: { orderBy: { createdAt: "asc" } } } } },
});
```

Raw query `SELECT id FROM queue_entries ...` chỉ lấy `id`, sau đó `findMany` fetch lại y hệt các row đó. Có thể gộp raw query lấy luôn `team_id`, `queued_at` và join thẳng vào bảng `team_members` để bỏ qua bước này.

**Tác động:** ~350ms + 1 DB round trip lãng phí mỗi lần match được tạo.

### File Ảnh Hưởng

| File                                    | Dòng    | Vấn đề                                  |
| --------------------------------------- | ------- | --------------------------------------- |
| `apps/api/src/queues/queues.service.ts` | 207-218 | `freshQueueEntry` — fetch thừa          |
| `apps/api/src/queues/queues.service.ts` | 261-280 | `findMany` sau `$queryRaw` — fetch thừa |

---

## 🟢 Vấn Đề Phụ: Khác

### SSL Mode Warning

Trong log có warning:

```
[Prisma Client] The "prefer" mode is deprecated and behaves like "require" in @prisma/adapter-pg.
```

Không gây ảnh hưởng hiệu năng đáng kể, nhưng nên set `sslmode=require` tường minh để clear warning.

### Webhook Retry Polling

`WebhookRetryProcessor` chạy `*/30 * * * * *` (mỗi 30 giây) query `webhook_deliveries` tìm pending deliveries. Query này cũng mất ~355ms mỗi lần do cold start. Khi không có webhook pending, đây là lãng phí tài nguyên.

---

## Tổng Hợp Fix Đề Xuất

### Fix 1 — Keepalive + Pool Config (Critical)

**File:** `apps/api/src/prisma/prisma.service.ts`

- Thêm `pool: { max: 3, idleTimeoutMillis: 0 }` vào `PrismaPg` adapter
- Thêm `setInterval(() => $queryRaw\`SELECT 1\`, 60_000)`trong`onModuleInit()`

**Tác động dự kiến:** Mỗi query giảm từ **350ms → <5ms** (tất cả endpoints)

### Fix 2 — Pooler Query String (Critical)

**File:** `apps/api/.env.production`

- Thêm `?pgbouncer=true&connection_limit=3` vào `DATABASE_URL`

### Fix 3 — Bỏ freshQueueEntry (Medium)

**File:** `apps/api/src/queues/queues.service.ts` (dòng 207-218)

- Dùng `queueEntry` từ transaction thay vì fetch lại

### Fix 4 — Gộp Raw Query (Low)

**File:** `apps/api/src/queues/queues.service.ts` (dòng 250-280)

- Raw query `SELECT ... FOR UPDATE SKIP LOCKED` lấy luôn `team_id`, `queued_at`
- Join `team_members` trong raw query, bỏ `findMany`

### Fix 5 — Async Matchmaking (Future)

Tách `tryCreateMatch()` ra khỏi request path. Enqueue trả về ngay, matchmaking chạy background. Cần message queue (Bull/BullMQ) hoặc `@Cron`.

---

## Tác Động Dự Kiến Sau Fix

| Endpoint                  | Trước       | Sau Fix 1+2+3 | Sau Fix 4+5 |
| ------------------------- | ----------- | ------------- | ----------- |
| `GET /health`             | 350-420ms   | **<10ms**     | **<10ms**   |
| `POST /v1/queues/enqueue` | 1200-1900ms | **200-400ms** | **<100ms**  |
| `GET /v1/matches/:id`     | 200ms       | **<20ms**     | **<20ms**   |
| `POST /v1/queues/dequeue` | 220ms       | **<30ms**     | **<30ms**   |

---

## Cập Nhật Sau Khi Fix (2026-07-09)

Đã đối chiếu report với code thực tế trên nhánh `fix/issue-10-api-performance` (base: `main`) và áp dụng fix tuần tự cho GitHub issue #10.

| #   | Fix                                                                 | Trạng thái                         | Ghi chú                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Keepalive + pool config (Critical)                                  | ✅ Applied                         | `prisma.service.ts`: `PrismaPg({ connectionString, max: 3, idleTimeoutMillis: 0, keepAlive: true })` + `setInterval(SELECT 1, 60s)` trong `onModuleInit()`, cleared trong `onModuleDestroy()`                     |
| 2   | `?pgbouncer=true` trên DATABASE_URL (Critical)                      | ⚠️ Không áp dụng — root cause khác | Xem "Đính chính" bên dưới                                                                                                                                                                                         |
| 3   | Bỏ `freshQueueEntry` refetch (Medium)                               | ✅ Applied                         | Bỏ `findUniqueOrThrow` sau `tryCreateMatch()`; response được dựng lại từ `queueEntry` (đã có sẵn từ transaction) + `matchId` trả về trực tiếp từ `tryCreateMatch()`, không cần round-trip DB nào thêm             |
| 4   | Gộp raw query `FOR UPDATE SKIP LOCKED` với fetch team members (Low) | ✅ Applied                         | Postgres không cho `FOR UPDATE` cùng `GROUP BY`, nên dùng CTE: `WITH locked AS (...FOR UPDATE SKIP LOCKED) SELECT ... json_agg(...) FROM locked LEFT JOIN team_members ... GROUP BY ...` — 1 round-trip thay vì 2 |
| 5   | Async matchmaking (Future)                                          | ⏭️ Chưa làm                        | Đúng như report đã đánh dấu "Future" — cần message queue (BullMQ) hoặc tách cron riêng, là thay đổi kiến trúc lớn hơn phạm vi issue này                                                                           |

### Đính chính Fix 2 — `pgbouncer=true` không áp dụng được

Report gốc giả định code dùng Prisma query engine nhị phân (nơi `pgbouncer=true` tắt prepared-statement caching để tương thích PgBouncer transaction mode). Nhưng `apps/api/src/prisma/prisma.service.ts` dùng **`@prisma/adapter-pg`** — driver adapter chạy thẳng qua `pg` (node-postgres), không qua query engine. Đã xác minh qua source `@prisma/adapter-pg` (Context7):

- Constructor `PrismaPg(poolOrConfig, options)` nhận thẳng `pg.PoolConfig` (không phải một field `pool` lồng bên trong) — report gốc ghi sai shape.
- Prepared statements **không được cache mặc định** (`statementNameGenerator` không được set), nên vấn đề tương thích PgBouncer mà tham số `pgbouncer=true` giải quyết vốn không tồn tại ở đây.
- `pg` (qua `pg-connection-string`) sẽ bỏ qua query param lạ như `pgbouncer=true` — thêm vào cũng không gây hại, nhưng cũng không có tác dụng gì.

→ Root cause thật của "mọi query mất 350-400ms" nhiều khả năng là pool không giữ kết nối sống (idle timeout mặc định + không có TCP/app-level keepalive) khiến mỗi query phải TCP+TLS handshake lại qua Neon pooler — đây là đúng vấn đề mà Fix 1 giải quyết.

### Giới hạn khi verify

- Typecheck (`tsc --noEmit`) và toàn bộ unit test suite (`jest`, 100/100) pass sau khi áp dụng Fix 1/3/4.
- **Không thể chạy e2e test hoặc kiểm chứng câu raw SQL CTE (Fix 4) trên Postgres thật** trong môi trường này (không có Docker/psql sẵn). Câu SQL đã được review thủ công (đúng tên bảng/cột theo `schema.prisma`, đúng cú pháp CTE + `FOR UPDATE SKIP LOCKED` + `json_agg ... FILTER`), nhưng nên chạy e2e suite (`apps/api/test`) trên môi trường có Postgres trước khi merge, đặc biệt luồng matchmaking (`tryCreateMatch`).
- Fix 1 (keepalive) và Fix 2 (pgbouncer, không áp dụng) cần verify lại số liệu latency thực tế trên Neon sau khi deploy — chưa có cách đo lại trong môi trường này.

## File Log Gốc

Log được capture từ: `docker logs -f matching-man-app` (khoảng 15 phút đầu sau khi start container)

```
[NestFactory] Starting application...
[InstanceLoader] ScheduleModule dependencies initialized
...
[PrismaService] Database connection established
[NestApplication] Nest application successfully started
```

Full log path: VPS Docker logs (không lưu local).
