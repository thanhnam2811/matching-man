# Phase 6: Admin UI and Operator Experience

## Status

- [x] Done

## Objective

Deliver a usable management surface for project owners.

## Implementation Checklist

- [x] Project list and detail views
- [x] API key management view (read-only at ship time; create/revoke added by Phase 7, see Notes)
- [x] Webhook endpoint management view (read-only at ship time; create/edit/delete added by Phase 7, see Notes)
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

- [x] `dashboard` — aggregates operator read surface (originally behind `DashboardAdminGuard`; **superseded by Phase 7**, see Notes below)

## Database Work

- [x] No new phase-specific database tables required

## API Endpoints

Dashboard read APIs (originally behind `DashboardAdminGuard`, now `DashboardAuthGuard` + `ProjectAccessGuard` per Phase 7; scoped by `:projectId` path param):

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

- New `DashboardModule` imports the four feature modules and exposes a single `DashboardController` under `projects/:projectId`. `MatchesService.listMatches` is new; the other three list methods were reused from earlier phases.
- Previously these reads existed only under `ProjectApiKeyGuard` (game-server auth); the dashboard admin token could not reach them.
- **Superseded by Phase 7** (`phase-7-dashboard-auth-and-tenancy.md`): at the time this phase shipped, the dashboard admin token was global (not tenant-scoped), so any valid admin token could read any project. `DashboardController` now runs behind `DashboardAuthGuard` + `ProjectAccessGuard`, which enforce per-user, tenant-scoped (`OrganizationMember`) authorization; `DashboardAdminGuard` still exists in the guards folder but is no longer used by this controller.

### Frontend (`apps/web`)

- Next.js 15 (App Router) + React 19 + Tailwind v3 + hand-written shadcn-style components (new-york, dark zinc, Geist). No eslint/create-next-app — repo's oxlint/oxfmt toolchain is reused.
- Auth at the time this phase shipped: operator pastes the dashboard admin token on `/login`; it is validated against `GET /v1/projects` then stored in an httpOnly cookie, with `middleware.ts` gating all routes. **Superseded by Phase 7**: login is now email/password against `POST /api/session`, sessions are per-user, and `middleware.ts` gates only `/dashboard/**`. All data fetching remains server-side via `lib/api.ts`, so no token/credential reaches the browser and there are no CORS concerns.
- Runs on port 3001 (`pnpm --dir apps/web dev`); reads the API base URL from `API_BASE_URL` (default `http://localhost:3000/v1`).
- Views were read-only at the time this phase shipped; mutations (create/edit project, keys, webhooks, environments, org members; dequeue; revoke) have since been added via server actions in `apps/web/lib/actions.ts`.
- Phase 7 also added an Organization tier not in this phase's original scope: `/dashboard/organizations/[orgId]` sits between the dashboard home and `/dashboard/projects/[projectId]`. See `apps/web/DESIGN.md` for the current route map.
- Verified at the time: `next build` green, oxlint clean, login renders and unauthenticated routes 307-redirect to `/login`. End-to-end data rendering required the API running with a configured `DASHBOARD_ADMIN_TOKEN`; this has been superseded by Phase 7's per-user auth (see above).
