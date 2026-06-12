# Architecture

## System Goal

Build a matchmaking platform that sits between multiple game servers and their players. Game servers call the hub to enqueue match candidates and later report match outcomes. The hub can then return outcomes asynchronously through signed webhooks.

## High-Level Architecture

The platform should be split into four major subsystems:

1. Control Plane
2. Matchmaking Engine
3. Rating Engine
4. Event Delivery

## Concrete Stack

The default implementation target for this repository is:

- API service: `NestJS`
- Dashboard UI: `Next.js`
- Database: `PostgreSQL`
- ORM and migrations: `Prisma`
- Authentication: project-local auth for dashboard users

For the MVP, background work should be implemented without requiring a dedicated always-on Redis queue worker. The first version should prefer:

- PostgreSQL-backed durable job tables
- NestJS scheduled processors for retries and timeout scans
- inline trigger plus short follow-up processing where safe

Redis and BullMQ remain valid future upgrades, but they are not required to ship the first usable version.

## 1. Control Plane

Responsible for tenant and configuration management.

Main responsibilities:

- manage organizations and users
- manage projects and environments
- issue and revoke API keys
- store webhook endpoints and signing secrets
- configure matchmaking modes and rules

Main consumers:

- admin dashboard UI
- internal operator tooling

## 2. Matchmaking Engine

Responsible for queue ingestion and match creation.

Main responsibilities:

- accept enqueue and dequeue requests
- place entries into the correct pool
- select candidates based on pool rules
- create a match record
- mark queue entries as matched, timed out, cancelled, or failed

Recommended internal components:

- `queue-ingest`
- `pool-store`
- `candidate-selector`
- `rule-evaluator`
- `match-assembler`
- `timeout-scanner`

## 3. Rating Engine

Responsible for rating-based matching inputs and optional internal Elo management.

Supported modes:

- `internal_elo`
- `external_rating`
- `disabled`

Behavior by mode:

- `internal_elo`
  - hub stores current rating per competitor
  - hub recalculates rating after result reports
  - hub stores rating history
- `external_rating`
  - game server sends current rating on enqueue
  - hub uses provided rating only for matchmaking
  - hub does not own the source of truth
- `disabled`
  - hub ignores rating and matches using neutral rules

## 4. Event Delivery

Responsible for asynchronous outbound callbacks.

Main responsibilities:

- deliver webhook events to game servers
- sign payloads
- retry transient failures
- persist delivery attempts and responses
- support dead-letter or terminal failed states

For the MVP, webhook delivery should use database-backed delivery jobs and a NestJS processor that periodically drains pending work. This keeps the deployment shape simple while preserving retryability and audit history.

## Domain Model

Initial core entities:

- `organizations`
- `users`
- `project_members`
- `projects`
- `api_keys`
- `webhook_endpoints`
- `game_modes`
- `match_pools`
- `queue_entries`
- `teams`
- `team_members`
- `matches`
- `match_slots`
- `match_results`
- `rating_profiles`
- `rating_history`
- `webhook_deliveries`

## Key Design Choice: Match Unit

The base matchmaking unit should be `team`.

Rationale:

- solo queue becomes a team of size 1
- party queue becomes a team of size N
- team-vs-team games fit naturally
- avoids rebuilding the model when moving beyond 1v1

## Key Design Choice: Slot-Based Matches

Matches must be modeled as `N slots`, not as a hard-coded two-side contest.

Required match slot fields:

- `slot_index`
- `group_index`

Both values are mandatory integers.

Rules:

- `slot_index` is the unique position inside the match
- `group_index` is the logical placement group for that slot
- `1 <= group_index <= group_count`
- free-for-all is represented by `group_count == required_slots`
- versus games are represented by `group_count == 2`

Examples:

- 1v1
  - required slots: 2
  - group count: 2
- 5v5
  - required slots: 2
  - group count: 2
  - each slot is a full team
- 4-player board game
  - required slots: 4
  - group count: 4
  - each slot is an independent competitor

## Core Flows

### Project Setup

1. dashboard user creates organization or project
2. user configures API key
3. user configures webhook endpoint
4. user configures game mode and rating mode

### Enqueue Flow

1. game server calls enqueue API
2. hub validates project API key
3. hub stores queue entry in a pool
4. NestJS matchmaking processor evaluates the pool
5. if enough candidates exist, hub creates a match
6. event delivery subsystem emits `match.created`

### Dequeue Flow

1. game server calls dequeue API
2. hub marks entry as cancelled if still waiting
3. cancelled entry is removed from future candidate selection

### Match Completion Flow

1. game server finishes a real game session
2. game server calls result report API
3. hub stores match result
4. if rating mode is `internal_elo`, rating engine recalculates ratings
5. hub emits completion and rating events through webhooks

## Matching Strategy

Each pool should be scoped by:

- project
- environment
- game mode
- optional region

Rule examples:

- `team_size_min`
- `team_size_max`
- `required_slots`
- `group_count`
- `match_structure`
- `max_queue_time_seconds`
- `rating_mode`
- `initial_rating_window`
- `window_expand_interval_seconds`
- `window_expand_step`

Suggested structure values:

- `VERSUS`
- `FFA`

Example rating window behavior:

- 0 to 15 seconds: rating delta <= 50
- 15 to 30 seconds: rating delta <= 100
- 30 to 60 seconds: rating delta <= 200
- after timeout: fail queue entry

## Reliability Requirements

### Idempotency

Required for:

- enqueue
- dequeue
- match result reporting

Clients should be able to pass an `idempotency_key` so retries do not create duplicate queue entries or duplicate result processing.

### Concurrency Control

The system must prevent one queue entry from being matched twice.

Expected techniques:

- transactional updates
- row-level locking or logical locks
- partitioning work by pool
- deterministic candidate ordering

### Webhook Reliability

Required behaviors:

- HMAC signature
- retry with backoff
- delivery status history
- failure visibility in dashboard

## Admin UI Responsibilities

The UI should support:

- login
- project list
- project detail
- API key management
- webhook configuration
- live or near-live pool inspection
- match history
- webhook delivery logs
- rating history when internal Elo is enabled

## Recommended Delivery Shape

For the first usable version:

- NestJS API service
- PostgreSQL for source-of-truth data and durable background job state
- in-process scheduled processors for:
  - matchmaking scans
  - queue timeout scans
  - webhook retry delivery
- Next.js dashboard separated from the public API

## Suggested NestJS Module Layout

- `auth`
- `organizations`
- `projects`
- `api-keys`
- `webhooks`
- `game-modes`
- `queues`
- `matches`
- `ratings`
- `deliveries`
- `health`
- `prisma`

## Deployment Shape for Side Project

Recommended initial deployment:

- `Next.js admin UI` on Vercel Hobby
- `NestJS API` on a small or free web service host
- `Neon Postgres` as the primary database

This split keeps the UI cheap to host and avoids forcing the API into a serverless shape that is awkward for periodic processors.
