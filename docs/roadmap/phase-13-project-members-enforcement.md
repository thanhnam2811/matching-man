# Phase 13: Project Members Access Enforcement

## Status

- [x] Done

## Objective

Wire the existing (previously inert) `ProjectMember` model into a real, additive
access gate on top of Phase 7's org-level tenancy, and expose project member
management in the dashboard. Graduated from the "Auth and Platform" backlog item
"Per-project member roles enforced distinctly from org roles."

## Stages

- [x] `ProjectAccessGuard` enforces `ProjectMember` for org `MEMBER`s; org
      `OWNER`/`ADMIN` keep full access to every project in their org
- [x] `ProjectsService.findAll`/`findOne` apply the same access model
- [x] Project member management (invite/role-change/remove) gated to org
      `ADMIN`+ or project `ADMIN`+; view-only for anyone with project access
- [x] Fixed `ProjectMembersService.create` silently creating passwordless ghost
      users for unregistered invite emails — now requires a pre-registered user
- [x] One-time backfill migration granted every existing org member a
      `ProjectMember` row (mirroring their org role) on every project in their
      org, so no one lost access on deploy
- [x] Dashboard: Members card on the project detail page, reusing a
      generalized `MembersManager` component shared with the organization page

## Notes

- Design: `docs/superpowers/specs/2026-07-17-project-members-access-enforcement-design.md`
- Auth0 / OAuth login remains a separate, unscheduled backlog item.
- The backfill is one-time, not an ongoing sync: org members added after this
  phase must be explicitly granted project access.
