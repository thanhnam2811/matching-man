# Phase 11: Shared Demo Account

## Status

- [x] Done

## Objective

This is a side project — let visitors explore the live dashboard without registering.
Add a one-click "View the demo" path on `/login` that signs the visitor into one
pre-seeded, shared account (full read/write) instead of requiring sign-up. Scoped to
the dashboard login flow only; unrelated to the existing unauthenticated `/demo`
matchmaking sandbox page.

## Background

`apps/api/scripts/seed-demo.mjs` already creates everything needed: a real dashboard
user `demo@matchinghub.dev` / `demo-password-123`, owning an org "Demo" and project
"demo-arena" with two game modes and five queued/matched players. It was written only
to mint an API key for the public `/demo` game sandbox, but the user it creates is a
normal, fully-functional dashboard account — no backend changes are required to make
it loggable-into from `/login`.

Auth flow recap: `apps/web/components/login-form.tsx` → `POST /api/session`
(`apps/web/app/api/session/route.ts`) → NestJS `POST /auth/login`
(`apps/api/src/auth/auth.service.ts`) → sets httpOnly cookie `dashboard_token`
(`TOKEN_COOKIE`, `apps/web/lib/api.ts`).

## Decisions

- Full read/write demo account (not read-only) — simplest, no new API guard needed.
  Shared mutable state is an accepted tradeoff for a side project; revisit with a
  reset cron only if the seeded data gets visibly trashed.
- One-click "View the demo" button — credentials never shown to or typed by the
  visitor, read server-side from env vars.

## Stage 1 — Demo login route

- [x] Add `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD` to `apps/web/.env.example`
      (matches the user seeded by `seed-demo.mjs`)
- [x] Extract a `loginAndSetSessionCookie(email, password)` helper in `apps/web/lib/api.ts`;
      refactor `apps/web/app/api/session/route.ts` to use it
- [x] New `POST apps/web/app/api/session/demo/route.ts`: reads the demo env vars, calls
      the shared helper, returns `503` if unconfigured or `401` if the account can't log in
- [x] Update the `seed-demo.mjs` header comment to note the seeded user now doubles as
      the dashboard's shared demo login

## Stage 2 — Login UI

- [x] `login-form.tsx`: add a secondary "View the demo" button that posts to
      `/api/session/demo` (no body) and redirects to `/dashboard` on success
- [x] Share the existing `pending`/`error` state between both buttons

**Exit criteria:** a reviewer opens `/login`, clicks "View the demo", and lands in the
dashboard on the seeded "Demo" org/project — no registration required.

## Stage 3 — Zero-config scheduled reset + demo status (added)

Because the account is shared read/write, its data drifts as visitors click around.
A cron restores a rich, fully-populated snapshot on an interval, and the dashboard
tells the visitor they're on the demo account and when the next reset lands. No env
is required — credentials default to `demo@matchinghub.dev` / `demo-password-123`
(overridable via `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD`).

- [x] `src/demo` module. `DemoService.reset()` is self-healing: (1) bootstraps the
      account (user + org + `demo-arena` project + game modes + API key) if missing;
      (2) purges visitor clutter — every project the demo user owns except
      `demo-arena`, plus any extra orgs they created (deep FK-ordered delete);
      (3) wipes and reseeds `demo-arena` with a self-contained snapshot: completed
      ranked matches with rating history, live + waiting queue entries, and webhook
      deliveries across all statuses, so every dashboard tab has data. The
      `demo-arena` project row + its API keys are preserved so ids stay stable.
- [x] `DemoResetProcessor` `@Cron` ticks each minute, reseeds once
      `DEMO_RESET_INTERVAL_MINUTES` (default 60) has elapsed (tracked in
      `system_settings`), reports to scheduler health, and no-ops under `NODE_ENV=test`
- [x] `/auth/me` includes a `demo` block (`isDemoAccount`, `nextResetAt`,
      `resetIntervalMinutes`); `DemoBanner` renders it with a live countdown
- [x] The `/login` demo button and API default to the same credentials, so the
      button works with no env set
- [x] Unit test asserts snapshot referential integrity + zero-sum rating deltas

## Verification

1. `pnpm docker:up` + run the API (no demo env needed); within a minute the cron
   auto-provisions the demo account and seeds `demo-arena`
2. Run the web app, click "View the demo" on `/login`, confirm redirect + seeded data
   across every tab (queues, matches, ratings, deliveries)
3. Create a throwaway project while logged into the demo account, wait for the next
   reset (drop `DEMO_RESET_INTERVAL_MINUTES=1` to speed it up), confirm it's purged
   and `demo-arena` is back to the seeded snapshot
4. Confirm normal email/password login still works unaffected

## Non-Goals

- Read-only enforcement / mutation guard for the demo account
- OAuth or any other guest-access mechanism
