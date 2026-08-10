# Backlog: Unscheduled Features

Features that are intended but not yet scheduled into a numbered phase. Pull an item
out of here into its own phase when it becomes a priority. Nothing here is committed
work — treat it as a menu, not a plan.

## Advanced Matchmaking

- [ ] Region-aware rules
- [ ] Latency-aware rules
- [ ] Accept or decline handshake
- [ ] Dispute states (manual resolution beyond the existing `DISPUTED` match status)

These are product/gameplay features. Accept/decline and disputes are the most
self-contained and could graduate to a phase on their own.

## Scale and Operations

- [ ] Partitioned pool processing
- [ ] Optional Redis and BullMQ adoption
- [ ] Separation of public API from worker processes

### When to introduce Redis / BullMQ

Only when one of these is actually observed — none are true today:

- Database-backed processors are too slow
- Webhook volume becomes bursty
- Strict worker isolation is needed
- Scheduling and retry load starts competing with API latency

Until then, the in-process scheduled processors (webhook retry, queue timeout) are
sufficient for hobby-scale traffic.

[`docs/performance.md`](../performance.md) now measures this rather than assuming it.
A single match pool saturates at ~65 enqueues/sec and ~33 matches/sec, bounded by the
`FOR UPDATE SKIP LOCKED` row lock in `tryCreateMatch` — not by job scheduling, which is
what Redis/BullMQ would replace. **Redis/BullMQ addresses no measured bottleneck and stays
deferred.** The two changes with evidence behind them, in order:

1. Raise the Prisma pool past `max: 3` — worth ~1.8x once more than one pool is busy.
2. Partitioned pool processing (below) — throughput scales with the number of distinct
   pools, so sharding hot pools turns one serialized pool into several parallel ones.

## Auth and Platform (future increments beyond Phase 7)

- [ ] OAuth / social login (Phase 7 ships email + password only)
- [ ] Org-level billing / usage metering
- [ ] Audit log for control-plane mutations
- [ ] Email verification and password reset flows

## Notes

- This file replaced the former "Phase 7: Advanced Matchmaking and Scale" doc. Phase 7
  is now "Dashboard Auth and Tenancy" — see `phase-7-dashboard-auth-and-tenancy.md`.
- Production-hardening items (OpenAPI docs, coverage reporting, rate limiting,
  observability, performance baseline) graduated to
  [`phase-9-production-hardening.md`](phase-9-production-hardening.md), now complete.
- Per-project member roles graduated to
  [`phase-13-project-members-enforcement.md`](phase-13-project-members-enforcement.md).
- No source evidence yet for any item in this file.
