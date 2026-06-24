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

- [ ] `users.password_hash` written on register, verified on login
- [ ] `POST /v1/auth/register` (email, password, name) → creates user + personal org + session
- [ ] `POST /v1/auth/login` → verify password, set session cookie
- [ ] `POST /v1/auth/logout`
- [ ] `GET /v1/auth/me` → current user + organization memberships
- [ ] `PasswordService` (scrypt hash/verify) and `SessionTokenService` (sign/verify)
- [ ] `UserSessionGuard` attaching the authenticated user to the request

## Stage 2 — Tenancy

- [ ] `organization_members` table (orgId, userId, role)
- [ ] Register seeds a personal organization with the user as `OWNER`
- [ ] `GET /v1/organizations` returns only the caller's organizations
- [ ] `POST /v1/organizations` creates a tenant owned by the caller
- [ ] Project creation requires caller membership in the target organization
- [ ] `GET /v1/projects` returns only projects in the caller's organizations
- [ ] Member invite / role change / removal at the organization level

## Stage 3 — Authorization rebind

- [ ] Control-plane and dashboard read routes accept a user session
- [ ] Project-scoped routes assert the caller is a member of the project's org
- [ ] `DASHBOARD_ADMIN_TOKEN` still works as super-admin
- [ ] Game-server routes keep using `ProjectApiKeyGuard` unchanged

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