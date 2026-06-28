# Phase 8 — Deploy to Public

Goal: make the landing page and live `/demo` reachable on the public internet.

## Architecture

```
Browser ──> Vercel (apps/web, Next.js) ──server-side──> Render (apps/api, NestJS) ──> Neon (Postgres)
```

- The web app calls the API **server-side only** (the demo API key never reaches the
  browser), so the API needs **no CORS** configuration.
- Node version is pinned to **24.17.0** via [`.node-version`](../../.node-version).
  This matters: Prisma 7's toolchain uses `require()` on an ESM module, which crashes
  on Node < 20.19 / < 22.12. Do not downgrade Node below the `engines` floor.

## Prerequisites

- Repo pushed to GitHub/GitLab (Render and Vercel deploy from a connected repo).
- Accounts: [Neon](https://neon.tech), [Render](https://render.com), [Vercel](https://vercel.com).

---

## Step 1 — Database (Neon)

1. Create a Neon project. Pick a region (remember it — match Render's region to it).
2. From the connection details, copy **two** strings:
    - **Pooled** (hostname contains `-pooler`) → `DATABASE_URL`
    - **Direct** (no `-pooler`) → `DATABASE_DIRECT_URL`
      Both should end with `?sslmode=require`.
3. No manual schema setup needed — migrations run automatically on API deploy (Step 2).

## Step 2 — API (Render)

1. In Render: **New + → Blueprint**, select this repo. It reads [`render.yaml`](../../render.yaml).
2. Render creates the `matching-man-api` web service and auto-generates
   `DASHBOARD_ADMIN_TOKEN` and `SESSION_SECRET`.
3. Set the two secrets it can't know — paste from Neon (Step 1):
    - `DATABASE_URL` = Neon **pooled** string
    - `DATABASE_DIRECT_URL` = Neon **direct** string
4. Deploy. On boot, `startCommand` runs `prisma migrate deploy` (applies all
   migrations in `apps/api/prisma/migrations`) then starts Nest.
5. Verify: open `https://<your-api>.onrender.com/health` → should return `200`.

> Free tier note: the service sleeps after ~15 min idle, so the first demo request
> after a quiet period takes a few seconds to cold-start. Upgrade the plan to avoid this.

## Step 3 — Seed the demo project

Run against the **production** API (not localhost):

```bash
API_BASE_URL=https://<your-api>.onrender.com/v1 node apps/api/scripts/seed-demo.mjs
```

Copy the printed `DEMO_*` block — you'll paste it into Vercel next.

## Step 4 — Web (Vercel)

1. **New Project** → import this repo.
2. Set **Root Directory = `apps/web`** (Vercel then auto-runs the pnpm workspace
   install at the repo root and `next build` in `apps/web`).
3. Confirm Node version is **22.x or 24.x** (Project → Settings → Node.js Version;
   Vercel also honors the root `engines.node`).
4. Add Environment Variables (Production) — see
   [`apps/web/.env.production.example`](../../apps/web/.env.production.example):
    - `API_BASE_URL` = `https://<your-api>.onrender.com/v1`
    - the five `DEMO_*` values from Step 3
5. Deploy. Visit `/` (landing) and `/demo` (should show the live board, not the
   "demo is not configured" card).

---

## Validation checklist

- [ ] `GET https://<api>/health` returns 200
- [ ] Landing page loads on the Vercel URL
- [ ] `/demo` shows the live board and pairing works (add players)
- [ ] `/login` + `/register` work against the prod API
- [ ] Dashboard routes redirect to `/login` when unauthenticated

## Rollback

- **Render**: dashboard → service → _Events/Deploys_ → roll back to a previous deploy.
- **Vercel**: dashboard → _Deployments_ → promote a previous deployment to Production.
- **DB migrations**: `prisma migrate deploy` only rolls forward. To undo a schema
  change, write a new corrective migration and redeploy — never hand-edit applied
  migrations.

## Cold starts & keep-warm

The free Render service sleeps after ~15 min idle and Neon's compute auto-suspends
after ~5 min, so the first demo request after a quiet period waits ~30s. Two layers
mitigate this:

- **Perceived**: the demo board polls `/api/demo/health` on load, warms the server,
  and shows a "waking the server" banner with Add disabled until it returns 200.
- **Actual**: a scheduled GitHub Action ([.github/workflows/keep-warm.yml](../../.github/workflows/keep-warm.yml))
  pings `/health` every ~10 min. Set the repo variable `KEEP_WARM_URL` to your API
  health URL if it differs from the default. Caveats: GitHub schedules are delayed/
  best-effort and disable after 60 days of repo inactivity; on a private repo the
  runs draw from the free Actions minutes.
- **Alternatives**: an external uptime pinger (UptimeRobot / cron-job.org) every
  5-10 min, or — the only true fix — upgrade Render to a paid always-on instance.

## Notes / future hardening

- Custom domain: add in Vercel (web) and optionally Render (API); update
  `API_BASE_URL` if the API domain changes.
- Rotating secrets: change `SESSION_SECRET` in Render to invalidate all dashboard
  sessions. Re-run the seed script if you rotate the demo project's API key.
- If you later add client-side calls directly to the API, enable CORS in
  `apps/api/src/main.ts` first.
