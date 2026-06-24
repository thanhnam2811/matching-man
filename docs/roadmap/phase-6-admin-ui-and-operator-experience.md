# Phase 6: Admin UI and Operator Experience

## Status

- [x] In progress (backend dashboard read API complete; Next.js UI pending)

## Objective

Deliver a usable management surface for project owners.

## Implementation Checklist

- [ ] Project list and detail views
- [ ] API key management view
- [ ] Webhook endpoint management view
- [ ] Pool monitor
- [ ] Match history view
- [ ] Delivery log view
- [ ] Rating history view

## UI Views

- [ ] Login
- [ ] Dashboard home
- [ ] Project settings
- [ ] Pool monitor
- [ ] Match history
- [ ] Webhook deliveries
- [ ] Rating history

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

- [ ] Operator can manage one project without touching the database directly
- [ ] Pool and delivery states are understandable from the UI

## Notes

- This session delivered only the backend prerequisite: dashboard-auth read endpoints. Previously these reads existed only under `ProjectApiKeyGuard` (game-server auth); the dashboard admin token could not reach them.
- New `DashboardModule` imports the four feature modules and exposes a single `DashboardController` under `projects/:projectId`. `MatchesService.listMatches` is new; the other three list methods were reused from earlier phases.
- The dashboard admin token is global (not tenant-scoped) in V1, so any valid admin token can read any project. Per-tenant authorization remains a future upgrade.
- Pending: Next.js + Tailwind + shadcn/ui admin app (login, dashboard home, project settings, pool monitor, match history, webhook deliveries, rating history). To be built in a follow-up session.