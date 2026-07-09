# Phase 10: Shared Demo Account

## Status

- [ ] In progress

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

- [ ] Add `DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD` to `apps/web/.env.example`
      (matches the user seeded by `seed-demo.mjs`)
- [ ] Extract a `loginAndSetSessionCookie(email, password)` helper in `apps/web/lib/api.ts`;
      refactor `apps/web/app/api/session/route.ts` to use it
- [ ] New `POST apps/web/app/api/session/demo/route.ts`: reads the demo env vars, calls
      the shared helper, returns `503` if unconfigured or `401` if the account can't log in
- [ ] Update the `seed-demo.mjs` header comment to note the seeded user now doubles as
      the dashboard's shared demo login

## Stage 2 — Login UI

- [ ] `login-form.tsx`: add a secondary "View the demo" button that posts to
      `/api/session/demo` (no body) and redirects to `/dashboard` on success
- [ ] Share the existing `pending`/`error` state between both buttons

**Exit criteria:** a reviewer opens `/login`, clicks "View the demo", and lands in the
dashboard on the seeded "Demo" org/project — no registration required.

## Verification

1. `pnpm docker:up`, then `pnpm api:seed:demo` (idempotent; confirms the demo user exists)
2. Add `DEMO_ACCOUNT_EMAIL`/`DEMO_ACCOUNT_PASSWORD` to `apps/web/.env`
3. Run the API and web app, click "View the demo" on `/login`, confirm redirect + seeded data
4. Confirm normal email/password login still works unaffected
5. Confirm the button surfaces a clean error if the env vars are unset

## Non-Goals

- Read-only enforcement / mutation guard for the demo account
- Scheduled reset of demo data
- OAuth or any other guest-access mechanism
