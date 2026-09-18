# AGENTS.md

Project-level instructions for coding agents working in this repository.

## Status

- This repository is an early-stage product scaffold for a multi-tenant matchmaking platform.
- The approved backend stack is `NestJS + Prisma + PostgreSQL`.
- The current package manager in `apps/api` is `pnpm`.
- The current application structure starts with `apps/api` for the NestJS service.

## First-Step Workflow

- Start every task by inspecting the current tree and git status.
- Treat existing files as the source of truth over prior assumptions.
- If the repo is still effectively empty, prefer proposing or creating the smallest viable scaffold that satisfies the user request.
- Before introducing a new stack or major dependency, state the choice and why it fits the request.

## Current Commands

- Workspace install: `pnpm install`
- Workspace format: `pnpm format`
- Workspace lint: `pnpm lint`
- API dev: `pnpm start:dev`
- API build: `pnpm api:build`
- API test: `pnpm api:test`
- API test with coverage: `pnpm api:test:cov`
- API e2e test: `pnpm api:test:e2e`
- API OpenAPI export: `pnpm --dir apps/api openapi:generate` (writes `docs/openapi.json`; needs `DATABASE_URL`, `DASHBOARD_ADMIN_TOKEN`, `SESSION_SECRET` set to any value, no live DB required)
- Prisma generate: `pnpm --dir apps/api prisma:generate`
- Prisma migrate (dev): `pnpm --dir apps/api prisma:migrate:dev`
- Prisma Studio: `pnpm --dir apps/api prisma:studio`
- Web dev: `pnpm --dir apps/web dev` (port 3001)
- Web build: `pnpm --dir apps/web build`
- Web typecheck: `pnpm --dir apps/web typecheck`

Run workspace commands from [matching-man](D:/Documents/matching-man).
Run NestJS dev server commands from [apps/api](D:/Documents/matching-man/apps/api).
The admin UI (`apps/web`) reads the API base URL from `API_BASE_URL` (default `http://localhost:3000/v1`) and authenticates with the dashboard admin token via an httpOnly cookie.

## Deployment

The API (`apps/api`) deploys as a Docker container to a self-hosted VPS (`/srv/matching-man`,
compose file `/srv/matching-man/docker-compose.vps.yml` on the box); the admin UI (`apps/web`)
deploys separately to Vercel.

- `pnpm docker:build` — build the API image locally (`Dockerfile`)
- `pnpm docker:up` — run Postgres only, for local dev against `pnpm start:dev`
- `docker compose up` — full stack (Postgres + built API image) via `docker-compose.yml`
- CI/CD (`.github/workflows/pipeline.yml`, push to `main`): lint/test → build & push image to
  `ghcr.io/thanhnam2811/matching-man` (`latest` + `:<sha>`) → SSH to the VPS with a restricted
  deploy key whose only allowed command is `deploy <sha>`, which runs
  `/home/namtt/ops/matching-man-deploy.sh <sha>` on the VPS: pull → `prisma migrate deploy`
  against the self-hosted database → recreate app + worker → health check → automatic
  rollback to the previous tag on failure.
- **Migrations run on the VPS during the rollout** — never in CI, never at container boot.
  If you change `apps/api/prisma/schema.prisma`, generate a real migration
  (`pnpm --dir apps/api prisma:migrate:dev --name <name>`) and commit it; the rollout only
  replays committed migration files, it does not diff the schema.
- Production secrets live only in `/srv/matching-man/.env.vps` on the VPS (mode 600); they are
  never committed and never passed through CI. `entrypoint.sh` does not run migrations at
  container boot, it only starts `node dist/src/main`.

## Decision Rules

- Keep one canonical implementation path. Avoid adding parallel frameworks, duplicate configs, or multiple package managers.
- Prefer boring, maintainable defaults over clever setup.
- Minimize dependency count unless a dependency clearly saves substantial effort or risk.
- Preserve user changes. Never overwrite or delete work you did not create unless explicitly asked.

## Editing Rules

- Make focused changes tied to the requested task.
- Keep files small and names obvious.
- Use ASCII unless the file already requires Unicode.
- Add comments only when the intent would otherwise be hard to infer.
- Do not leave placeholder code, fake TODO implementations, or dead scaffolding without marking it clearly.

## Validation

- After code changes, run the smallest relevant validation available.
- If tests or linters do not exist yet, say so explicitly instead of inventing checks.
- When adding a new toolchain, also add the minimum commands needed to verify it locally.

## Git Hygiene

- Do not revert unrelated user changes.
- Avoid destructive commands such as hard resets or broad deletes unless explicitly requested.
- Keep changes easy to review and logically grouped.

## Documentation

- When the project gains a concrete stack, update this file with:
    - setup commands
    - dev and test commands
    - repo structure
    - code style constraints
    - deployment or environment notes
- If a tool-specific file is needed later, keep `AGENTS.md` as the canonical source and make the other file a thin pointer.

## Repo Structure

- `apps/api`: NestJS API service. Self-documenting via Swagger UI at `/v1/docs`; see `docs/api-spec-v1.md`.
- `apps/web`: Next.js admin/operator dashboard (App Router, Tailwind, shadcn-style components). Follow [apps/web/DESIGN.md](apps/web/DESIGN.md) for UI style, theming, and the server-action/data-fetch patterns.
- `docs`: product, architecture, API, and roadmap documents

## Skills

Use these Claude Code skills for the following task categories:

| Task                                                                        | Skill                        |
| --------------------------------------------------------------------------- | ---------------------------- |
| Complex TypeScript types, Prisma generics, DTO inference, conditional types | `/typescript-advanced-types` |
| Review API security: auth middleware, HMAC webhook signing, API key hashing | `/security-review`           |
| Post-implementation code quality pass: simplify, remove duplication         | `/simplify`                  |
| Pull request review                                                         | `/review`                    |
| Reduce Claude Code permission prompts for new commands                      | `/less-permission-prompts`   |

Phase 6+ (Admin UI): if a Next.js + Tailwind frontend is added, also use `/next-best-practices`, `/tailwind-design-system`, `/radix-ui-design-system`.

## Empty-Repo Behavior

- If asked to bootstrap the project, create only what is required for the requested outcome.
- If the request is ambiguous and the repo has no code, prefer a minimal foundation plus a short note about the chosen direction.
- Do not fabricate product requirements, hidden APIs, or nonexistent infrastructure.
