# Phase 5: Internal Elo

## Status

- [ ] Not started

## Objective

Add hub-owned rating updates and history.

## Implementation Checklist

- [ ] Rating profiles
- [ ] Result-driven Elo recalculation
- [ ] Rating history log
- [ ] Rating history API
- [ ] `rating.updated` webhook

## NestJS Modules

- [ ] `ratings`
- [ ] `matches`
- [ ] `deliveries`

## Database Work

- [ ] `rating_profiles`
- [ ] `rating_history`
- [ ] `match_results`

## API Endpoints

- [ ] `POST /v1/matches/:matchId/report-result`
- [ ] `GET /v1/projects/:projectId/rating-history`

## Internal Services

- [ ] `RatingCalculationService`
- [ ] `RatingHistoryService`

## Done Checklist

- [ ] Match result updates internal rating when enabled
- [ ] Rating changes are traceable per competitor
- [ ] Webhook is emitted after rating finalization

## Notes

- No source evidence yet for `rating_profiles`, `rating_history`, `match_results`, or result-report processing.