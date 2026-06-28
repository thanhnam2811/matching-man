# Phase 3: Delivery and Operational Reliability

## Status

- [x] Done

## Objective

Make the system safe to retry and operable for real integrations.

## Implementation Checklist

- [x] Idempotency handling
- [x] Webhook signing
- [x] Webhook delivery attempts
- [x] Retry with backoff
- [x] Timeout scan for queue entries
- [x] Operator visibility for deliveries and waiting pools

## NestJS Modules

- [x] `deliveries`
- [x] `queues`
- [x] `matches`

## Database Work

- [x] `webhook_deliveries`
- [x] Idempotency fields on `queue_entries` (`idempotency_key`, `dequeue_idempotency_key`)
- [x] Queue timeout fields (`timed_out_at` on `queue_entries`, `max_queue_seconds` on `game_modes`)

## API Endpoints

- [x] `GET /v1/queues/pools` — returns active pool list with QUEUED count per pool
- [x] `GET /v1/deliveries` — paginated delivery log, filterable by status and endpointId (project API key scoped; dashboard path deferred to Phase 6)

## Internal Services

- [x] `WebhookDeliveryService` — scheduleDelivery, sendPendingDeliveries, listDeliveries
- [x] `WebhookRetryProcessor` — cron every 30s, drains PENDING/FAILED deliveries
- [x] `QueueTimeoutProcessor` — cron every 60s, JOINs `game_modes.max_queue_seconds`, fires `queue.timeout` webhook

## Done Checklist

- [x] Duplicate enqueue requests are safely handled (result-report idempotency deferred to Phase 5)
- [x] Webhook failures are recorded and retried
- [x] Queue timeouts produce visible state changes (`TIMED_OUT` status + webhook event)
- [x] Operators can inspect delivery failures (via `GET /v1/deliveries`)

## Notes

- Retry schedule: 5 attempts at 0s, 30s, 5m, 30m, 2h. After 5 failures status becomes `EXHAUSTED`.
- HMAC signing: `X-Webhook-Signature: sha256=<hex>` using `TIMESTAMP.BODY` payload with hex key decoded from `whsec_` prefix.
- Concurrent delivery safety: processor batch is 50 items; no row-level lock on deliveries — acceptable for current single-instance deployment. Redis/BullMQ remains a documented future upgrade path.
- Match result-report idempotency is Phase 5 scope (result reporting endpoint doesn't exist yet).
- Dashboard-auth delivery visibility route (`GET /v1/projects/:projectId/webhook-deliveries`) deferred to Phase 6 when Admin UI is built.
