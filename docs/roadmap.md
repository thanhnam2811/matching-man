# Roadmap

## Goal

Provide a phase-by-phase implementation plan that is concrete enough to guide coding order, module boundaries, and definition of done.

## Working Principles

- Build around `NestJS` as the API backbone
- Keep `PostgreSQL` as the source of truth
- Prefer durable state in the database over in-memory assumptions
- Ship the smallest end-to-end useful flow before adding advanced matchmaking logic
- Design for multi-tenant isolation from day one

## Phase Documents

- [Phase 0: Foundation](./roadmap/1-phase-0-foundation.md)
- [Phase 1: Control Plane MVP](./roadmap/2-phase-1-control-plane-mvp.md)
- [Phase 2: Queue Ingest and Basic Matchmaking](./roadmap/3-phase-2-queue-ingest-and-basic-matchmaking.md)
- [Phase 3: Delivery and Operational Reliability](./roadmap/4-phase-3-delivery-and-operational-reliability.md)
- [Phase 4: External Rating Refinement](./roadmap/5-phase-4-external-rating-refinement.md)
- [Phase 5: Internal Elo](./roadmap/6-phase-5-internal-elo.md)
- [Phase 6: Admin UI and Operator Experience](./roadmap/7-phase-6-admin-ui-and-operator-experience.md)
- [Phase 7: Advanced Matchmaking and Scale](./roadmap/8-phase-7-advanced-matchmaking-and-scale.md)

## Immediate Coding Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Minimal admin UI shell
6. Phase 4
7. Phase 5

## Non-Goals for Early Phases

- billing
- public marketplace
- tournament bracket logic
- anti-cheat or fraud systems
- season reset automation
- multi-region active-active deployment
