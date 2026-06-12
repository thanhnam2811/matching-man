# Phase 4: External Rating Refinement

## Status

- [x] Complete

## Objective

Improve rating-aware matching without taking ownership of rating state yet.

## Implementation Checklist

- [x] Mode-level rating config
- [x] Rating window rules
- [x] Rating-based candidate filtering
- [ ] History view for rating snapshots if desired (deferred to Phase 6 Admin UI)

## NestJS Modules

- [x] `game-modes`
- [x] `queues`
- [x] `matches`

## Database Work

- [x] Enrich game mode table with rating window fields (`initialRatingWindow`, `windowExpandIntervalSeconds`, `windowExpandStep`)
- [x] Optional storage for external rating snapshots per queue entry

## API Endpoints

- [x] No new public endpoint required yet

## Internal Services

- [x] Rating mode is enforced through `GameModesService` and queue ingestion logic

## Done Checklist

- [x] Each game mode can define its own rating mode
- [x] External rating affects matching window correctly
- [x] Neutral matching still works when rating is disabled

## Notes

- `GameMode` now carries `initialRatingWindow`, `windowExpandIntervalSeconds`, `windowExpandStep` — all optional, must be set together, only valid when `ratingMode = EXTERNAL_RATING`.
- `QueuesService.selectCandidateQueueEntries` enforces the window: anchor entry's elapsed queue time determines the current window via `initialRatingWindow + floor(elapsed / interval) * step`. Candidates outside the window are excluded. When no window is configured, behavior falls back to closest-rating selection.
- History view for rating snapshots deferred to Phase 6 when Admin UI is available.