# Phase 4: External Rating Refinement

## Status

- [ ] Not started

## Objective

Improve rating-aware matching without taking ownership of rating state yet.

## Implementation Checklist

- [ ] Mode-level rating config
- [ ] Rating window rules
- [ ] Rating-based candidate filtering
- [ ] History view for rating snapshots if desired

## NestJS Modules

- [ ] `game-modes`
- [ ] `queues`
- [ ] `matches`

## Database Work

- [ ] Enrich game mode and pool rule tables
- [ ] Optional storage for external rating snapshots per queue entry

## API Endpoints

- [ ] No new public endpoint required yet

## Internal Services

- [ ] No phase-specific internal service list yet

## Done Checklist

- [ ] Each game mode can define its own rating mode
- [ ] External rating affects matching window correctly
- [ ] Neutral matching still works when rating is disabled

## Notes

- External rating remains an input into matching, not a system-owned source of truth in this phase.
