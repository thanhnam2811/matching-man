# Phase 4: External Rating Refinement

## Status

- [x] In progress

## Objective

Improve rating-aware matching without taking ownership of rating state yet.

## Implementation Checklist

- [x] Mode-level rating config
- [ ] Rating window rules
- [ ] Rating-based candidate filtering
- [ ] History view for rating snapshots if desired

## NestJS Modules

- [x] `game-modes`
- [x] `queues`
- [x] `matches`

## Database Work

- [ ] Enrich game mode and pool rule tables
- [x] Optional storage for external rating snapshots per queue entry

## API Endpoints

- [x] No new public endpoint required yet

## Internal Services

- [x] Rating mode is enforced through `GameModesService` and queue ingestion logic

## Done Checklist

- [x] Each game mode can define its own rating mode
- [ ] External rating affects matching window correctly
- [x] Neutral matching still works when rating is disabled

## Notes

- Source evidence: `GameMode.ratingMode`, `QueueEntry.ratingMode`, and `TeamMember.ratingSnapshot` already exist in schema and service flow.
- Missing work: there is still no rating window expansion or candidate filtering by rating.
