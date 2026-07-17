# Phase 12: Live Demo → Demo Account Integration

## Status

- [x] Done

## Objective

The public `/demo` matchmaking sandbox required an operator to run
`apps/api/scripts/seed-demo.mjs` by hand and paste five `DEMO_*` values into
`apps/web`'s env — a manual step that could drift from the `demo-arena` project
the shared dashboard demo account (Phase 11) and its hourly reset cron actually
maintain. This phase removes the manual step entirely: `/demo` now fetches its
project id, API key, and game mode ids live from the API, so every visitor
action is automatically logged inside the same demo account visible from the
dashboard's "View the demo" login.

## Changes

- `DemoService` now persists the demo project's raw API key in `system_settings`
  (`demo:api_key`) when it mints one, and rotates it once for any pre-existing
  deployment that only has an unrecoverable hashed key on file.
- New public `GET /v1/demo/config` endpoint returns `{ projectId, apiKey,
environment, gameModes }` for the current `demo-arena` project.
- `apps/web/lib/demo.ts` fetches that config (60s in-memory cache) instead of
  reading `DEMO_API_KEY` / `DEMO_PROJECT_ID` / `DEMO_GAME_MODE_SKILL` /
  `DEMO_GAME_MODE_CASUAL` from env.
- `apps/api/scripts/seed-demo.mjs` and its deploy-runbook step are retired —
  `DemoResetProcessor`'s cron already bootstraps the account within 60s of the
  API starting.

## Verification

1. Fresh DB, boot the API with no `DEMO_*` env vars set anywhere. Within a
   minute, `GET /v1/demo/config` returns a live config.
2. Run the web app with no `DEMO_*` vars in `apps/web/.env`; open `/demo`,
   confirm it's enabled (no "not configured" card) and adding a player works.
3. Add a player on `/demo`, then log into the dashboard demo account
   (`/login` → "View the demo") and confirm the queue entry / resulting match
   shows up in the `demo-arena` project's Queues/Matches tabs.
4. Confirm the shared dashboard demo login and its hourly reset still work
   unaffected (Phase 11 behavior unchanged).

## Non-Goals

- Any change to `DemoService.reset()`'s snapshot content or cadence.
- A new auth mechanism between web and api — `/demo/config` stays
  unauthenticated, protected only by the existing global per-IP throttler.
