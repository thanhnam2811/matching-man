# Phase 1: Control Plane MVP

## Status

- [x] Done

## Objective

Allow a dashboard user to create and manage projects that game servers can authenticate against.

## Implementation Checklist

- [x] Organizations
- [x] Users
- [x] Project membership
- [x] Projects
- [x] Project environments
- [x] API key creation and revocation
- [x] Webhook endpoint CRUD
- [x] Basic dashboard auth contract

## NestJS Modules

- [x] `auth`
- [x] `organizations`
- [x] `projects`
- [x] `api-keys`
- [x] `webhooks`

## Database Work

- [x] `users`
- [x] `organizations`
- [x] `project_members`
- [x] `projects`
- [x] `api_keys`
- [x] `webhook_endpoints`

## API Endpoints

- [x] `POST /v1/projects`
- [x] `POST /v1/projects/:projectId/api-keys`
- [x] `POST /v1/projects/:projectId/webhooks`

## Internal Services

- [x] `OrganizationsService`
- [x] `ProjectsService`
- [x] `ApiKeysService`
- [x] `WebhooksService`
- [x] `AuthService`

## Done Checklist

- [x] Dashboard user can create project
- [x] Dashboard user can issue API key
- [x] Dashboard user can register webhook
- [x] Game server authentication model is fixed and documented

## Notes

- Source evidence: `projects`, `organizations`, `project members`, `project environments`, `api-keys`, `webhooks`, and `auth` control-plane surfaces are implemented.
- Dashboard auth was intentionally minimal at the time this phase shipped: a shared dashboard admin bearer token protected the control-plane surface. **Superseded by Phase 7** (`phase-7-dashboard-auth-and-tenancy.md`), which replaced this with per-user email/password auth and tenant-scoped (organization-role) authorization — the shared admin token is no longer the primary dashboard auth path.
