# Phase 7: Dashboard Auth and Tenancy

## Status

- [ ] In progress

## Objective

Replace the single shared dashboard admin token with real per-user accounts and a
multi-tenant model, so the dashboard behaves like a proper platform console
(Vercel / Supabase style): a user registers, owns an organization (tenant), creates
projects inside it, and invites teammates with roles.

## Background

- Today `AuthService` only validates one shared `DASHBOARD_ADMIN_TOKEN`. There is no
  register/login, no password verification (the `users.password_hash` column exists
  but is unused), and the token sees every project (not tenant-scoped).
- `users`, `organizations`, and `project_members` (with `OWNER/ADMIN/MEMBER`) already
  exist in the schema. The missing piece is an `organization_members` join and the
  auth/session layer.

## Auth Model Decisions (V1)

- Email + password only (OAuth deferred to backlog).
- Password hashing with `scrypt` from `node:crypto` — no new dependency.
- Stateless session: a signed token (HMAC-SHA256 over a base64url JSON payload with an
  `exp` claim) stored in an httpOnly cookie. Mirrors the existing webhook HMAC style;
  no JWT dependency.
- The shared `DASHBOARD_ADMIN_TOKEN` is retained as a break-glass super-admin path.
- Tenant boundary is the **organization**. A user may access a project if they are a
  member of that project's organization.

## Stage 1 — Auth core

- [x] `users.password_hash` written on register, verified on login
- [x] `POST /v1/auth/register` (email, password, name) → creates user + personal org + session
- [x] `POST /v1/auth/login` → verify password, returns session token
- [x] `GET /v1/auth/me` → current user + organization memberships
- [x] `PasswordService` (scrypt hash/verify) and `SessionTokenService` (sign/verify)
- [x] `UserSessionGuard` attaching the authenticated user to the request
- [~] Logout is handled client-side by clearing the cookie (stateless token, nothing to revoke server-side)

## Stage 2 — Tenancy

- [x] `organization_members` table (orgId, userId, role) — reuses the `ProjectMemberRole` enum
- [x] Register seeds a personal organization with the user as `OWNER`
- [x] `GET /v1/organizations` returns only the caller's organizations
- [x] `POST /v1/organizations` creates a tenant owned by the caller
- [x] Project creation requires caller membership in the target organization
- [x] `GET /v1/projects` returns only projects in the caller's organizations
- [x] Member invite / role change / removal at the organization level

## Stage 3 — Authorization rebind

- [x] Combined `DashboardAuthGuard` (admin token super-admin OR user session) landed in Stage 2
- [x] `DASHBOARD_ADMIN_TOKEN` still works as super-admin
- [x] `organizations` and `projects` routes rebound to `DashboardAuthGuard` + org membership
- [ ] Remaining control-plane routes (api-keys, webhooks, environments, project-members) rebound
- [ ] Dashboard read routes (pools, matches, deliveries, rating-history) rebound + membership-scoped
- [x] Game-server routes keep using `ProjectApiKeyGuard` unchanged

## Stage 4 — Frontend (apps/web)

- [ ] Register and login pages (email + password) replace the token-paste screen
- [ ] Org switcher in the dashboard shell
- [ ] Create organization and create project flows
- [ ] Member management UI (list, invite, change role, remove)
- [ ] `GET /v1/auth/me` drives the authenticated shell

## Done Checklist

- [ ] A new user can register, land in their own tenant, and create a project from the UI
- [ ] A user only sees organizations and projects they belong to
- [ ] Roles gate destructive actions
- [ ] The shared admin token still works for break-glass access

## Notes

- Scale and advanced-matchmaking work that previously lived in Phase 7 moved to
  `backlog.md`.