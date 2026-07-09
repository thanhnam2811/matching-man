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

## Stage 3 — Scheduled reset + demo status (added)

Because the account is shared read/write, its data drifts as visitors click around.
A cron restores a rich, fully-populated snapshot on an interval, and the dashboard
tells the visitor they're on the demo account and when the next reset lands.

- [x] API env: `DEMO_ACCOUNT_EMAIL` (enables the feature) + `DEMO_RESET_INTERVAL_MINUTES`
      (default 60) in `apps/api/.env.example` and `env.validation.ts`
- [x] `src/demo` module: `DemoService.reset()` wipes only the demo project's activity
      data (queues, teams, matches, results, ratings, deliveries) and reseeds a
      self-contained snapshot — completed ranked matches with rating history, live + waiting queue entries, and webhook deliveries across all statuses, so every
      dashboard tab has data. Durable objects (user, org, project, game modes, API
      keys) are preserved so the public `/demo` page's API key keeps working.
- [x] `DemoResetProcessor` `@Cron` ticks each minute, reseeds once the interval has
      elapsed (tracked in `system_settings`), and reports to scheduler health
- [x] `/auth/me` includes a `demo` block (`isDemoAccount`, `nextResetAt`,
      `resetIntervalMinutes`); `DemoBanner` renders it with a live countdown
- [x] Unit test asserts snapshot referential integrity + zero-sum rating deltas

Not covered: purging visitor-created _extra_ orgs/projects (only the canonical
`demo-arena` project is restored). Acceptable — the showcase the visitor lands on
stays pristine; broad account purge can follow if clutter becomes a problem.

## Verification

1. `pnpm docker:up`, then `pnpm api:seed:demo` (idempotent; confirms the demo user exists)
2. Add `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` to `apps/web/.env`
3. Run the API and web app, click "View the demo" on `/login`, confirm redirect + seeded data
4. Confirm normal email/password login still works unaffected
5. Confirm the button surfaces a clean error if the env vars are unset

## Non-Goals

- Read-only enforcement / mutation guard for the demo account
- Purging visitor-created extra orgs/projects (only `demo-arena` is restored)
- OAuth or any other guest-access mechanism
