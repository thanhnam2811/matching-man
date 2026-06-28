# Matching Hub

Multi-tenant matchmaking platform for game servers.

## Product Summary

Matching Hub provides a central API that game servers can call to:

- register projects and environments
- enqueue players or teams into matchmaking pools
- receive async webhook callbacks when a match succeeds, times out, or fails
- optionally use rating-aware matchmaking
- optionally let the hub manage internal Elo

The platform also includes an admin UI for operators to:

- manage projects, API keys, and webhook endpoints
- inspect live matchmaking pools
- review match history
- review rating history when internal Elo is enabled

## Technical Direction

- Backend API: `NestJS`
- Primary database: `PostgreSQL`
- ORM: `Prisma`
- Admin UI: `Next.js`
- MVP deployment posture: `free-tier-first`

The MVP should avoid hard dependency on an always-on Redis worker. Matching scans and webhook retries should initially work with PostgreSQL-backed jobs and NestJS scheduled or triggered processors. Redis and BullMQ can be added later when throughput justifies the extra moving parts.

## Core Capabilities

- Multi-tenant project management
- Matchmaking pools per project and game mode
- Webhook-based match result delivery
- Optional rating modes:
    - internal Elo managed by the hub
    - external rating supplied by the game server
    - rating disabled for neutral matching
- Audit-friendly history for queue entries, matches, and webhook deliveries

## MVP Scope

- Authentication for dashboard users
- Organizations and projects
- API keys per project
- Webhook endpoint management
- Enqueue and dequeue API
- Basic pool-based matchmaking
- Match history
- Webhook delivery log
- Rating mode configuration with initial support for:
    - external rating
    - no rating

Internal Elo should be designed into the domain model early, but can be implemented after the first usable release.

## Documents

- [Architecture](D:/Documents/matching-man/docs/architecture.md)
- [API Spec v1](D:/Documents/matching-man/docs/api-spec-v1.md)
- [Roadmap Folder](D:/Documents/matching-man/docs/roadmap)

## Build Order

1. Control plane foundation
2. Queue ingest and basic matchmaking
3. Webhook delivery and operator visibility
4. External rating refinement
5. Internal Elo
6. Advanced matchmaking and scaling
