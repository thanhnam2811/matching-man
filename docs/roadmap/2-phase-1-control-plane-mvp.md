# Phase 1: Control Plane MVP

## Status

- [ ] Not started

## Objective

Allow a dashboard user to create and manage projects that game servers can authenticate against.

## Implementation Checklist

- [ ] Organizations
- [ ] Users
- [ ] Project membership
- [ ] Projects
- [ ] Project environments
- [ ] API key creation and revocation
- [ ] Webhook endpoint CRUD
- [ ] Basic dashboard auth contract

## NestJS Modules

- [ ] `auth`
- [ ] `organizations`
- [ ] `projects`
- [ ] `api-keys`
- [ ] `webhooks`

## Database Work

- [ ] `users`
- [ ] `organizations`
- [ ] `project_members`
- [ ] `projects`
- [ ] `api_keys`
- [ ] `webhook_endpoints`

## API Endpoints

- [ ] `POST /v1/projects`
- [ ] `POST /v1/projects/:projectId/api-keys`
- [ ] `POST /v1/projects/:projectId/webhooks`

## Internal Services

- [ ] No phase-specific internal service list yet

## Done Checklist

- [ ] Dashboard user can create project
- [ ] Dashboard user can issue API key
- [ ] Dashboard user can register webhook
- [ ] Game server authentication model is fixed and documented

## Notes

- This phase defines the control plane contract used by both operators and game servers.
