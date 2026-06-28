# Auth & Tenancy

Two auth planes: **game servers** use a per-project API key; **dashboard users** use a session
token (or the shared admin token for break-glass). Dashboard access is tenant-scoped — a user
only reaches a project if they belong to its organization.

## Tenancy model

```mermaid
flowchart LR
    User -->|"OrganizationMember<br/>(OWNER / ADMIN / MEMBER)"| Org["Organization (tenant)"]
    Org -->|owns| Project
    Project --> Res["API keys · webhooks · environments<br/>game modes · pools · matches<br/>deliveries · rating history"]
```

Register seeds a personal `Organization` with the user as `OWNER`. Project access = membership
in the project's organization. Roles gate management actions (invite/role/remove need `ADMIN+`;
an org keeps at least one `OWNER`).

## Guard pipeline per route group

```mermaid
flowchart TD
    Req["Incoming request"] --> Kind{"Route group"}

    Kind -->|"game server:<br/>/queues, /matches, /ratings, /deliveries"| PK["ProjectApiKeyGuard<br/>(project API key → authProjectId)"]
    Kind -->|"public:<br/>/auth/register, /auth/login"| Pub["no guard"]
    Kind -->|"/auth/me"| US["UserSessionGuard"]
    Kind -->|"/organizations, /projects"| DA["DashboardAuthGuard"]
    Kind -->|"/projects/:id/* sub-resources<br/>(api-keys, webhooks, environments,<br/>members, game-modes, dashboard reads)"| DA2["DashboardAuthGuard"] --> PA["ProjectAccessGuard"]

    DA --> Tok{"Bearer token"}
    Tok -->|"== DASHBOARD_ADMIN_TOKEN"| SA["isSuperAdmin = true<br/>(bypass tenant scoping)"]
    Tok -->|"valid session token"| UU["authUserId = user"]

    PA --> Mem{"super-admin OR<br/>member of project's org?"}
    Mem -->|yes| OK["allow"]
    Mem -->|no| F["403 Forbidden"]
```

All project-scoped control-plane and dashboard-read routes — including `game-modes` — go
through `DashboardAuthGuard + ProjectAccessGuard`. Only game-server routes use
`ProjectApiKeyGuard`, and `/auth/login`/`/auth/register` are public.

## Session token

Stateless: `base64url(JSON{ sub, exp })` + `.` + HMAC-SHA256(payload, `SESSION_SECRET`),
verified in `SessionTokenService`. Stored by the web app in an httpOnly cookie. Passwords are
hashed with `scrypt` (`node:crypto`), no external dependency.
