# Phase 7: Dashboard Auth and Tenancy

## Status

- [x] Done

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
- [x] Remaining control-plane routes (api-keys, webhooks, environments, project-members, game-modes) rebound via `ProjectAccessGuard`
- [x] Dashboard read routes (pools, matches, deliveries, rating-history) rebound + membership-scoped
- [x] Game-server routes keep using `ProjectApiKeyGuard` unchanged

## Stage 4 — Frontend (apps/web)

Broken into shippable slices, each its own commit.

### Stage 4a — Auth screens

- [x] Email + password login form replaces the token-paste screen
- [x] Register page (email, password, name, optional org name)
- [x] `/api/session` (login) and `/api/register` route handlers call the API and store the session token cookie
- [x] `GET /v1/auth/me` drives the authenticated shell (show current user, wire logout)

### Stage 4b — Organizations & project creation

- [x] Dashboard home lists the user's organizations (`GET /organizations`)
- [x] Organization detail page lists its projects; project pages link back to the org
- [x] Create organization flow (server action)
- [x] Create project flow scoped to an organization (server action)

### Stage 4c — Project resource mutations

- [x] Create / revoke API keys (raw key shown once)
- [x] Create / enable-disable / delete webhook endpoints
- [x] Create / delete environments

### Stage 4d — Member management

- [x] Organization members: list, invite by email, change role, remove (role-gated to ADMIN+)
- [~] Project members deferred — org membership is the tenant boundary in V1

## Done Checklist

- [x] A new user can register, land in their own tenant, and create a project from the UI
- [x] A user only sees organizations and projects they belong to
- [x] Roles gate destructive actions (member management is ADMIN+; last-owner protected)
- [x] The shared admin token still works for break-glass access

## Notes

- Project-scoped routes (`projects/:projectId/...`) are guarded by `ProjectAccessGuard`,
  which resolves the project's organization and checks membership. It runs after
  `DashboardAuthGuard` and is a pure guard swap — no service or DTO changes. `PrismaModule`
  was made `@Global` so the guard resolves `PrismaService` in any module's context.
- Scale and advanced-matchmaking work that previously lived in Phase 7 moved to
  `backlog.md`.