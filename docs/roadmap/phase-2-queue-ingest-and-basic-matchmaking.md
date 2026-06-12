# Phase 2: Queue Ingest and Basic Matchmaking

## Status

- [x] In progress

## Objective

Ship the first end-to-end matchmaking flow without internal Elo.

## Implementation Checklist

- [x] Enqueue endpoint
- [x] Dequeue endpoint
- [x] Game mode config
- [x] Pool assignment
- [x] Basic candidate selection
- [x] Match creation
- [x] Match read endpoint

## Matching Rules in Scope

- [x] Match by project
- [x] Match by environment
- [x] Match by game mode
- [x] Match by region if provided
- [x] Slot-based match assembly
- [x] Support `external_rating`
- [x] Support `disabled`

## NestJS Modules

- [x] `game-modes`
- [x] `queues`
- [x] `matches`

## Database Work

- [x] `game_modes`
- [x] `match_pools`
- [x] `queue_entries`
- [x] `teams`
- [x] `team_members`
- [x] `matches`
- [x] `match_slots`

## API Endpoints

- [x] `POST /v1/queues/enqueue`
- [x] `POST /v1/queues/dequeue`
- [x] `GET /v1/matches/:matchId`

## Internal Services

- [x] `QueuesService`
- [x] Pool assignment logic exists inside `QueuesService`
- [x] Candidate selection logic exists inside `QueuesService`
- [x] Match assembly logic exists inside `QueuesService`

## Match Model Rules

- [x] Queue unit is always `team`
- [x] Every created match must use strict slots
- [x] Every slot includes `slot_index`
- [x] Every slot includes `group_index`
- [x] Free-for-all modes use `group_count == required_slots`
- [x] Versus modes use `group_count == 2`

## Done Checklist

- [x] Authenticated game server can enqueue a team
- [x] System can create a match from waiting entries
- [x] Queue entries cannot be matched twice
- [x] Match record is queryable after creation

## Notes

- Source evidence: authenticated enqueue and dequeue endpoints, pool upsert, row locking with `FOR UPDATE SKIP LOCKED`, match creation, and match reads are implemented.
- The flow currently lives in one consolidated service instead of the roadmap's more granular service split.
