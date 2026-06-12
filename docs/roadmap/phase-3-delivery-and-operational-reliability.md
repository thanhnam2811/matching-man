# Phase 3: Delivery and Operational Reliability

## Status

- [ ] Not started

## Objective

Make the system safe to retry and operable for real integrations.

## Implementation Checklist

- [ ] Idempotency handling
- [ ] Webhook signing
- [ ] Webhook delivery attempts
- [ ] Retry with backoff
- [ ] Timeout scan for queue entries
- [ ] Operator visibility for deliveries and waiting pools

## NestJS Modules

- [ ] `deliveries`
- [ ] `queues`
- [ ] `matches`

## Database Work

- [ ] `webhook_deliveries`
- [ ] Idempotency tables or equivalent persisted keys
- [ ] Queue timeout fields

## API Endpoints

- [ ] `GET /v1/projects/:projectId/pools`
- [ ] `GET /v1/projects/:projectId/webhook-deliveries`

## Internal Services

- [ ] `WebhookDeliveryService`
- [ ] `WebhookRetryProcessor`
- [ ] `QueueTimeoutProcessor`

## Done Checklist

- [ ] Duplicate enqueue or result-report requests are safely handled
- [ ] Webhook failures are recorded and retried
- [ ] Queue timeouts produce visible state changes
- [ ] Operators can inspect delivery failures

## Notes

- Partial prerequisite only: enqueue idempotency already exists on `queue_entries`, but there is no delivery subsystem, retry processor, or timeout scanner yet.