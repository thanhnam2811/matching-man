# Phase 8 — Deploy to Public

Goal: make the landing page and live `/demo` reachable on the public internet.

> **History**: this API originally deployed to Render (see git history for
> `render.yaml` / `keep-warm.yml`). It has since migrated to a self-hosted VPS
> running Docker, following the same pattern as the sibling `tiny-link` project
> (see its `docs/roadmap/phase-3_devops-deployment.md`) — no cold starts, no
> free-tier limits, full control over the container.

## Architecture

```
Browser ──> Vercel (apps/web, Next.js) ──server-side──> VPS/Docker (apps/api, NestJS) ──> Neon (Postgres)
```

- The web app calls the API **server-side only** (the demo API key never reaches the
  browser), so the API needs **no CORS** configuration.
- Node version is pinned to the major version **24** via [`.node-version`](../../.node-version)
  (not an exact patch, so `nvm`/`fnm`/`asdf`/CI can resolve whatever `24.x` is already
  installed instead of forcing a fresh install for a specific patch). This matters:
  Prisma 7's toolchain uses `require()` on an ESM module, which crashes on Node < 20.19 /
  < 22.12. Do not downgrade Node below the `engines` floor.
- The API container is stateless and disposable — Postgres stays external on Neon,
  not containerized on the VPS.

## Prerequisites

- Repo pushed to GitHub (`thanhnam2811/matching-man`).
- Accounts/infra: [Neon](https://neon.tech), [Vercel](https://vercel.com), a VPS with
  Docker + Docker Compose installed, and `cloudflared` (Cloudflare Tunnel) running on
  the VPS as a system service, fronting both SSH (for CI deploys) and the public HTTPS
  hostname routed to the API container's port 3000.
- GitHub Actions secrets (repo → Settings → Secrets and variables → Actions):
    - `DATABASE_URL`, `DATABASE_DIRECT_URL` — Neon connection strings (used by the
      `db_migrate` CI job)
    - `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` — Cloudflare Access service
      token, used to open the SSH tunnel from CI to the VPS
    - `VPS_SSH_PRIVATE_KEY`, `VPS_SSH_HOSTNAME`, `VPS_SSH_USER` — SSH credentials for
      the VPS (reachable only through the Cloudflare Tunnel, not a public port)
    - `GITHUB_TOKEN` is provided automatically by Actions; used both to push to GHCR
      and to `docker login` on the VPS during deploy.

---

## Step 1 — Database (Neon)

1. Create a Neon project. Pick a region close to the VPS to cut latency.
2. From the connection details, copy **two** strings:
    - **Pooled** (hostname contains `-pooler`) → `DATABASE_URL`
    - **Direct** (no `-pooler`) → `DATABASE_DIRECT_URL`
      Both should end with `?sslmode=require`.
3. No manual schema setup needed — migrations run in CI (Step 2) before every deploy.

## Step 2 — API (VPS via Docker)

Deploys are driven entirely by [`.github/workflows/pipeline.yml`](../../.github/workflows/pipeline.yml)
on every push to `main`:

1. **`lint_test`** — installs deps, applies the schema to an ephemeral Postgres
   service container, lints, builds, and runs unit + e2e tests.
2. **`db_migrate`** — runs `prisma migrate deploy` against the real Neon database
   (`DATABASE_DIRECT_URL`), applying `apps/api/prisma/migrations` **before** the image
   is built, so a container restart never races a half-applied migration.
3. **`build_and_push`** — builds the [`Dockerfile`](../../Dockerfile) (multi-stage,
   non-root user, healthcheck on `/health`) and pushes
   `ghcr.io/thanhnam2811/matching-man:latest` + `:<sha>` to GHCR.
4. **`deploy_production`** — opens an SSH connection to the VPS through a Cloudflare
   Tunnel (`cloudflared access ssh`), copies [`docker-compose.prod.yml`](../../docker-compose.prod.yml)
   to `/root/apps/matching-man/` on the VPS, then runs
   `docker compose -f docker-compose.prod.yml pull && up -d && docker image prune -f`.

The container itself never runs migrations or a `prisma` CLI — see
[`entrypoint.sh`](../../entrypoint.sh), which only waits for Neon to wake from
auto-suspend (`pg_isready` retry loop) before starting `node dist/src/main`.

**One-time VPS setup** (not automated, do once per VPS):

1. `mkdir -p /root/apps/matching-man` and place a real `apps/api/.env.production`
   there (copy from [`apps/api/.env.production.example`](../../apps/api/.env.production.example),
   fill in the Neon URLs and generate `DASHBOARD_ADMIN_TOKEN`/`SESSION_SECRET` with
   `openssl rand -hex 32`). This file is never committed or copied by CI.
2. Confirm Docker + Docker Compose are installed and `cloudflared` is configured as a
   system service exposing both the SSH tunnel (for CI) and a public hostname routed
   to `localhost:3000` (for the API itself).
3. Verify: `curl https://<your-vps-api-hostname>/health` → should return `200`.

## Step 3 — Web (Vercel)

1. **New Project** → import this repo.
2. Set **Root Directory = `apps/web`** (Vercel then auto-runs the pnpm workspace
   install at the repo root and `next build` in `apps/web`).
3. Confirm Node version is **22.x or 24.x** (Project → Settings → Node.js Version;
   Vercel also honors the root `engines.node`).
4. Add Environment Variables (Production) — see
   [`apps/web/.env.production.example`](../../apps/web/.env.production.example):
    - `API_BASE_URL` = `https://<your-vps-api-hostname>/v1`
5. Deploy. Visit `/` (landing) and `/demo` (should show the live board, not the
   "demo is not configured" card).

---

## Validation checklist

- [ ] `GET https://<vps-api-hostname>/health` returns 200
- [ ] Landing page loads on the Vercel URL
- [ ] `/demo` shows the live board and pairing works (add players)
- [ ] `/login` + `/register` work against the prod API
- [ ] Dashboard routes redirect to `/login` when unauthenticated
- [ ] Pushing to `main` triggers the pipeline and a new container is live on the VPS
      (`docker ps` on the VPS shows a fresh `CreatedAt` for `matching-man-app`)

## Rollback

- **VPS/API**: re-run `deploy_production` against an older commit (or SSH in and
  `docker compose -f docker-compose.prod.yml pull` a specific `:<sha>` tag manually),
  then `up -d`.
- **Vercel**: dashboard → _Deployments_ → promote a previous deployment to Production.
- **DB migrations**: `prisma migrate deploy` only rolls forward. To undo a schema
  change, write a new corrective migration and redeploy — never hand-edit applied
  migrations.

## Notes / future hardening

- Custom domain: add in Vercel (web) and point the VPS's Cloudflare Tunnel hostname
  (API) at your domain; update `API_BASE_URL` if the API domain changes.
- Rotating secrets: change `SESSION_SECRET` in the VPS's `apps/api/.env.production`
  and restart the container to invalidate all dashboard sessions. To rotate the demo
  project's API key, delete its row in the DB — the demo-reset cron (`DemoService`)
  self-heals by minting a fresh key and persisting it to `system_settings` within a
  minute, and `/demo/config` picks it up automatically.
- If you later add client-side calls directly to the API, enable CORS in
  `apps/api/src/main.ts` first.
- No cold-start mitigation is needed on a VPS (always-on) — Neon itself still
  auto-suspends after idle, which `entrypoint.sh`'s wakeup retry loop already covers.
