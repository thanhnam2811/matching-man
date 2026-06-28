# Phase 6: Admin UI and Operator Experience

## Status

- [x] Done

## Objective

Deliver a usable management surface for project owners.

## Implementation Checklist

- [x] Project list and detail views
- [x] API key management view (read-only)
- [x] Webhook endpoint management view (read-only)
- [x] Pool monitor
- [x] Match history view
- [x] Delivery log view
- [x] Rating history view

## UI Views

- [x] Login
- [x] Dashboard home
- [x] Project settings
- [x] Pool monitor
- [x] Match history
- [x] Webhook deliveries
- [x] Rating history

## NestJS Modules

- [x] `dashboard` — aggregates operator read surface behind `DashboardAdminGuard`

## Database Work

- [x] No new phase-specific database tables required

## API Endpoints

Dashboard read APIs (all behind `DashboardAdminGuard`, scoped by `:projectId` path param):

- [x] `GET /v1/projects/:projectId/pools`
- [x] `GET /v1/projects/:projectId/matches` (filters: gameModeId, status, from, to, limit, offset)
- [x] `GET /v1/projects/:projectId/webhook-deliveries` (filters: status, endpointId, limit, offset)
- [x] `GET /v1/projects/:projectId/rating-history` (filters: playerId, gameModeId, limit, offset)

## Internal Services

- [x] Reuses `QueuesService.listPools`, `MatchesService.listMatches`, `WebhookDeliveryService.listDeliveries`, `RatingsService.listHistory`

## Done Checklist

- [x] Operator can manage one project without touching the database directly
- [x] Pool and delivery states are understandable from the UI

## Notes

### Backend (dashboard read API)

- New `DashboardModule` imports the four feature modules and exposes a single `DashboardController` under `projects/:projectId`, all behind `DashboardAdminGuard`. `MatchesService.listMatches` is new; the other three list methods were reused from earlier phases.
- Previously these reads existed only under `ProjectApiKeyGuard` (game-server auth); the dashboard admin token could not reach them.
- The dashboard admin token is global (not tenant-scoped) in V1, so any valid admin token can read any project. Per-tenant authorization remains a future upgrade.

### Frontend (`apps/web`)

- Next.js 15 (App Router) + React 19 + Tailwind v3 + hand-written shadcn-style components (new-york, dark zinc, Geist). No eslint/create-next-app — repo's oxlint/oxfmt toolchain is reused.
- Auth: operator pastes the dashboard admin token on `/login`; it is validated against `GET /v1/projects` then stored in an httpOnly cookie. `middleware.ts` gates all routes. All data fetching is server-side via `lib/api.ts`, so the token never reaches the browser and there are no CORS concerns.
- Runs on port 3001 (`pnpm --dir apps/web dev`); reads the API base URL from `API_BASE_URL` (default `http://localhost:3000/v1`).
- Views are currently read-only. Mutations (create/edit project, keys, webhooks; dequeue; revoke) are a future increment.
- Verified: `next build` green, oxlint clean, login renders and unauthenticated routes 307-redirect to `/login`. End-to-end data rendering requires the API running with a configured `DASHBOARD_ADMIN_TOKEN`.
