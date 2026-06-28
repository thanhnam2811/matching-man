# Phase 5: Internal Elo

## Status

- [x] Done

## Objective

Add hub-owned rating updates and history.

## Implementation Checklist

- [x] Rating profiles
- [x] Result-driven Elo recalculation
- [x] Rating history log
- [x] Rating history API
- [x] `rating.updated` webhook

## NestJS Modules

- [x] `ratings`
- [x] `matches`
- [x] `deliveries`

## Database Work

- [x] `rating_profiles`
- [x] `rating_history`
- [x] `match_results`

## API Endpoints

- [x] `POST /v1/matches/:matchId/report-result`
- [x] `GET /v1/ratings/history` (project API key scoped; dashboard path deferred to Phase 6)

## Internal Services

- [x] `RatingsService` — Elo calculation + history query (merged, small scope)

## Done Checklist

- [x] Match result updates internal rating when enabled
- [x] Rating changes are traceable per competitor
- [x] Webhook is emitted after rating finalization

## Notes

- Elo formula: K=32, initial rating=1200. Team-vs-team uses average opposing team rating as the reference for each individual's expected score.
- `report-result` is idempotent on matchId: if a result already exists, the existing outcome is replayed without re-processing.
- `ratingUpdateStatus` in the response: `skipped` when ratingMode ≠ INTERNAL_ELO or no winnerGroupIndex provided; `completed` when Elo was calculated synchronously.
- `rating_profiles` are scoped per (projectId, gameModeId, playerId) so a player can have independent ratings across game modes.
- FFA Elo is out of scope for V1; only VERSUS (2-group) matches trigger rating updates.
- Dashboard-auth rating history route deferred to Phase 6.
