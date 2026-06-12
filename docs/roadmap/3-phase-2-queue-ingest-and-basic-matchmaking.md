# Phase 2: Queue Ingest and Basic Matchmaking

## Status

- [ ] Not started

## Objective

Ship the first end-to-end matchmaking flow without internal Elo.

## Implementation Checklist

- [ ] Enqueue endpoint
- [ ] Dequeue endpoint
- [ ] Game mode config
- [ ] Pool assignment
- [ ] Basic candidate selection
- [ ] Match creation
- [ ] Match read endpoint

## Matching Rules in Scope

- [ ] Match by project
- [ ] Match by environment
- [ ] Match by game mode
- [ ] Match by region if provided
- [ ] Slot-based match assembly
- [ ] Support `external_rating`
- [ ] Support `disabled`

## NestJS Modules

- [ ] `game-modes`
- [ ] `queues`
- [ ] `matches`

## Database Work

- [ ] `game_modes`
- [ ] `match_pools`
- [ ] `queue_entries`
- [ ] `teams`
- [ ] `team_members`
- [ ] `matches`
- [ ] `match_slots`

## API Endpoints

- [ ] `POST /v1/queues/enqueue`
- [ ] `POST /v1/queues/dequeue`
- [ ] `GET /v1/matches/:matchId`

## Internal Services

- [ ] `QueueService`
- [ ] `PoolAssignmentService`
- [ ] `CandidateSelectorService`
- [ ] `MatchAssemblerService`

## Match Model Rules

- [ ] Queue unit is always `team`
- [ ] Every created match must use strict slots
- [ ] Every slot includes `slot_index`
- [ ] Every slot includes `group_index`
- [ ] Free-for-all modes use `group_count == required_slots`
- [ ] Versus modes use `group_count == 2`

## Done Checklist

- [ ] Authenticated game server can enqueue a team
- [ ] System can create a match from waiting entries
- [ ] Queue entries cannot be matched twice
- [ ] Match record is queryable after creation

## Notes

- This is the first full gameplay-facing flow and should stay minimal until it is stable.
