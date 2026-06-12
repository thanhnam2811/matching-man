# Phase 1: Control Plane MVP

## Status

- [x] In progress

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

- Source evidence: `projects`, `api-keys`, `webhooks`, `organizations`, and `auth` controllers and services are implemented.
- Dashboard auth is still only a documented contract endpoint, not a real login or session flow.
