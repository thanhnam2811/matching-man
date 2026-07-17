# Project Members Access Enforcement — Design

## Status

- [ ] Draft

## Objective

`ProjectMember` (role `OWNER`/`ADMIN`/`MEMBER`) already exists in the schema and has a
working CRUD API (`ProjectMembersController`/`ProjectMembersService`), created as part
of Phase 7. It has never been wired into authorization: `ProjectAccessGuard` grants
access purely on **organization** membership, so `ProjectMember` rows currently carry
no meaning. This phase makes `ProjectMember` a real, additive access gate, on top of
the existing org-level tenancy from Phase 7.

Auth0 / OAuth login is explicitly out of scope — tracked as a separate follow-up phase
in `docs/roadmap/backlog.md`.

## Background (current state)

- `ProjectAccessGuard` (`apps/api/src/common/guards/project-access/project-access.guard.ts`):
  super-admin bypasses; otherwise checks only that the caller has an `OrganizationMember`
  row for the project's org. Never reads `ProjectMember`.
- `ProjectsService.findAll` / `findOne`: same org-membership-only check.
- `ProjectsService.create` already auto-adds the creator as a `ProjectMember` with role
  `OWNER` (`apps/api/src/projects/projects.service.ts:39-41`) — this part needs no change.
- `ProjectMembersController` (list/add/update/remove) is gated by
  `DashboardAuthGuard` + `ProjectAccessGuard` only — no role check distinguishing who
  may manage members from who may merely view the project.
- `ProjectMembersService.create` uses `user.upsert(...)`: if the invited email has no
  account yet, it silently creates a passwordless "ghost" user row. This diverges from
  `OrganizationsService.addMember`, which requires the invitee to already be a
  registered user (404 otherwise).
- `OrganizationsService` already has the pattern to follow: a `ROLE_RANK` map
  (`OWNER: 3, ADMIN: 2, MEMBER: 1`) and an `assertAccess(context, orgId, minRole?)`
  helper used by every org-scoped service method.
- No frontend UI exists for project members. The org members UI
  (`apps/web/app/dashboard/organizations/[orgId]/page.tsx`) uses a reusable
  `MembersManager` component, currently hard-coded to the organization API path.

## Access Model

Additive gate, layered on top of the existing org tenant boundary:

- Super-admin (break-glass `DASHBOARD_ADMIN_TOKEN`): bypasses everything, unchanged.
- Org role `OWNER` or `ADMIN`: full access to every project in that org — unchanged
  from today's behavior.
- Org role `MEMBER`: access to a project **only if** a `ProjectMember` row exists for
  (that project, that user). No row → 403, even though they can see the org.

This mirrors the Vercel-style pattern: broad org roles keep broad reach, while regular
members are scoped per-project so a large org doesn't expose every project to every
member by default.

### Where the check lives

Add a project-scoped equivalent of `OrganizationsService.assertAccess`, e.g.
`ProjectsService.assertAccess(context, projectId, minRole?)`:

1. Super-admin → pass.
2. Load the project's `organizationId`, then the caller's `OrganizationMember` role for
   that org (404 if project missing, 403 if no org membership at all).
3. If org role rank ≥ `ADMIN` → pass (regardless of `minRole`, matching "org
   OWNER/ADMIN always has full project access").
4. Otherwise (org role `MEMBER`): load the caller's `ProjectMember` row for this
   project. 403 if missing. If `minRole` was requested, also require
   `ProjectMember.role` rank ≥ `minRole`.

`ProjectAccessGuard` delegates to this method instead of doing its own Prisma query.
`ProjectsService.findAll` additionally filters: for non-super-admin, non-org-admin
callers, only return projects where a `ProjectMember` row exists for them (org
OWNER/ADMIN callers keep seeing every project in their orgs, as today).

## Managing Project Members

`ProjectMembersController` mutation endpoints (`create`/`update`/`remove`) call
`assertAccess(context, projectId, ADMIN)` — which per the rule above already
implements "org role ≥ ADMIN OR project role ≥ ADMIN" (step 3 passes org admins
unconditionally; step 4 requires project rank ≥ ADMIN for plain org members). The
`findAll` (list) endpoint only needs the no-`minRole` check, i.e. any org
admin/owner or any project member (regardless of role) can view the list.

## Bug Fix: No Ghost Users on Invite

`ProjectMembersService.create` changes from `user.upsert(...)` to `user.findUnique(...)`,
throwing `NotFoundException` ("No registered user with that email; ask them to sign up
first") when the invitee doesn't exist yet — matching
`OrganizationsService.addMember`'s existing behavior exactly.

## Backfill Migration

A one-time data migration (Prisma migration with a data-fixing script, or an
equivalent one-off script run as part of this phase's rollout — implementation detail
for the plan) that, for every existing `Project`, finds every `OrganizationMember` of
that project's org lacking a `ProjectMember` row and creates one with
`role = OrganizationMember.role`.

This must ship in the same release as the guard change (or run immediately before it
goes live) — otherwise org `MEMBER`s who aren't yet backfilled would be locked out of
projects they currently have access to. This is a one-time backfill, not an ongoing
sync: org members added _after_ this phase ships must be explicitly granted project
access by an org ADMIN+ or project OWNER/ADMIN — that's the point of the gate.

## Frontend

Generalize `apps/web/components/members-manager.tsx` to accept a configurable API base
path (org vs. project members endpoint) and a `canManage` flag computed by the caller,
instead of being hard-coded to organizations. Add a "Members" card to the project
detail page
(`apps/web/app/dashboard/projects/[projectId]/page.tsx`), following the same layout as
the organization page's Members card.

`canManage` on the project page = caller's org role is `ADMIN`/`OWNER` OR caller's
`ProjectMember` role (if any) is `ADMIN`/`OWNER`.

## Testing

- `project-access.guard.spec.ts`: cases for org MEMBER with and without a matching
  `ProjectMember` row; org ADMIN/OWNER always passes regardless of `ProjectMember`
  state.
- `project-members.service.spec.ts`: extend for the OR permission check (org admin
  without project row still allowed to manage; project ADMIN without org admin role
  also allowed), the ghost-user fix (404 on unregistered email), and existing
  last-owner protection continues to pass.
- `projects.service.spec.ts`: `findAll` filtering for org MEMBER vs org ADMIN/OWNER.
- Manual/staging verification of the backfill script's effect before it touches
  production data (per `AGENTS.md` validation rules — this is a data migration
  affecting real access, not just a code change).

## Out of Scope

- Auth0 / OAuth login (separate phase, backlog item).
- Any change to `OrganizationMember` behavior or org-level roles.
- Redis/BullMQ, rate limiting, or any Phase 9 production-hardening item.
