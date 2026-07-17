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
  [`phase-9-production-hardening.md`](phase-9-production-hardening.md) — the active phase.
- Per-project member roles graduated to
  [`phase-13-project-members-enforcement.md`](phase-13-project-members-enforcement.md).
- The Redis/BullMQ decision above should be revisited with real numbers once Phase 9
  Stage 6 (performance baseline) lands.
- No source evidence yet for any item in this file.
