# Roadmap

## Goal

Provide a phase-by-phase implementation plan that is concrete enough to guide coding order, module boundaries, and definition of done.

## Working Principles

- Build around `NestJS` as the API backbone
- Keep `PostgreSQL` as the source of truth
- Prefer durable state in the database over in-memory assumptions
- Ship the smallest end-to-end useful flow before adding advanced matchmaking logic
- Design for multi-tenant isolation from day one

## Phase 0: Foundation

### Objective

Create the repository baseline and engineering conventions.

### Deliverables

- NestJS API scaffold
- Prisma setup with PostgreSQL connection
- environment configuration strategy
- health endpoint
- error format standard
- request validation baseline
- structured logging baseline

### NestJS Modules

- `app`
- `config`
- `health`
- `prisma`

### Database Work

- initialize Prisma schema
- configure migration workflow
- define shared columns and naming conventions

### Done Criteria

- app boots locally
- database connects successfully
- first migration can be created and applied
- `/health` returns healthy state

## Phase 1: Control Plane MVP

### Objective

Allow a dashboard user to create and manage projects that game servers can authenticate against.

### Deliverables

- organizations
- users
- project membership
- projects
- project environments
- API key creation and revocation
- webhook endpoint CRUD
- basic dashboard auth contract

### NestJS Modules

- `auth`
- `organizations`
- `projects`
- `api-keys`
- `webhooks`

### Database Work

- `users`
- `organizations`
- `project_members`
- `projects`
- `api_keys`
- `webhook_endpoints`

### API Endpoints

- `POST /v1/projects`
- `POST /v1/projects/:projectId/api-keys`
- `POST /v1/projects/:projectId/webhooks`

### Done Criteria

- dashboard user can create project
- dashboard user can issue API key
- dashboard user can register webhook
- game server authentication model is fixed and documented

## Phase 2: Queue Ingest and Basic Matchmaking

### Objective

Ship the first end-to-end matchmaking flow without internal Elo.

### Deliverables

- enqueue endpoint
- dequeue endpoint
- game mode config
- pool assignment
- basic candidate selection
- match creation
- match read endpoint

### Matching Rules in Scope

- match by project
- match by environment
- match by game mode
- match by region if provided
- support `external_rating` and `disabled`

### NestJS Modules

- `game-modes`
- `queues`
- `matches`

### Database Work

- `game_modes`
- `match_pools`
- `queue_entries`
- `teams`
- `team_members`
- `matches`
- `match_participants`

### API Endpoints

- `POST /v1/queues/enqueue`
- `POST /v1/queues/dequeue`
- `GET /v1/matches/:matchId`

### Internal Services

- `QueueService`
- `PoolAssignmentService`
- `CandidateSelectorService`
- `MatchAssemblerService`

### Done Criteria

- authenticated game server can enqueue a team
- system can create a match from waiting entries
- queue entries cannot be matched twice
- match record is queryable after creation

## Phase 3: Delivery and Operational Reliability

### Objective

Make the system safe to retry and operable for real integrations.

### Deliverables

- idempotency handling
- webhook signing
- webhook delivery attempts
- retry with backoff
- timeout scan for queue entries
- operator visibility for deliveries and waiting pools

### NestJS Modules

- `deliveries`
- `queues`
- `matches`

### Database Work

- `webhook_deliveries`
- idempotency tables or equivalent persisted keys
- queue timeout fields

### API Endpoints

- `GET /v1/projects/:projectId/pools`
- `GET /v1/projects/:projectId/webhook-deliveries`

### Internal Services

- `WebhookDeliveryService`
- `WebhookRetryProcessor`
- `QueueTimeoutProcessor`

### Done Criteria

- duplicate enqueue or result-report requests are safely handled
- webhook failures are recorded and retried
- queue timeouts produce visible state changes
- operators can inspect delivery failures

## Phase 4: External Rating Refinement

### Objective

Improve rating-aware matching without taking ownership of rating state yet.

### Deliverables

- mode-level rating config
- rating window rules
- rating-based candidate filtering
- history view for rating snapshots if desired

### NestJS Modules

- `game-modes`
- `queues`
- `matches`

### Database Work

- enrich game mode and pool rule tables
- optional storage for external rating snapshots per queue entry

### Done Criteria

- each game mode can define its own rating mode
- external rating affects matching window correctly
- neutral matching still works when rating is disabled

## Phase 5: Internal Elo

### Objective

Add hub-owned rating updates and history.

### Deliverables

- rating profiles
- result-driven Elo recalculation
- rating history log
- rating history API
- `rating.updated` webhook

### NestJS Modules

- `ratings`
- `matches`
- `deliveries`

### Database Work

- `rating_profiles`
- `rating_history`
- `match_results`

### API Endpoints

- `POST /v1/matches/:matchId/report-result`
- `GET /v1/projects/:projectId/rating-history`

### Internal Services

- `RatingCalculationService`
- `RatingHistoryService`

### Done Criteria

- match result updates internal rating when enabled
- rating changes are traceable per competitor
- webhook is emitted after rating finalization

## Phase 6: Admin UI and Operator Experience

### Objective

Deliver a usable management surface for project owners.

### Deliverables

- project list and detail views
- API key management view
- webhook endpoint management view
- pool monitor
- match history view
- delivery log view
- rating history view

### UI Views

- login
- dashboard home
- project settings
- pool monitor
- match history
- webhook deliveries
- rating history

### Done Criteria

- operator can manage one project without touching the database directly
- pool and delivery states are understandable from the UI

## Phase 7: Advanced Matchmaking and Scale

### Objective

Handle higher traffic and more complex matchmaking constraints.

### Deliverables

- region-aware rules
- latency-aware rules
- accept or decline handshake
- dispute states
- partitioned pool processing
- optional Redis and BullMQ adoption

### When to Introduce Redis and BullMQ

Adopt them only if one or more become true:

- database-backed processors are too slow
- webhook volume becomes bursty
- strict worker isolation is needed
- scheduling and retry load starts competing with API latency

### Done Criteria

- system can scale beyond simple hobby traffic
- architecture can separate public API from worker processes cleanly

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
