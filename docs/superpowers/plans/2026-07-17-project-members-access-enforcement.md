# Project Members Access Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing (currently inert) `ProjectMember` model a real, additive access gate on top of Phase 7's org-level tenancy — org OWNER/ADMIN keep full reach across their org's projects, org MEMBER needs an explicit `ProjectMember` row per project.

**Architecture:** No schema changes. Extend the existing `ProjectAccessGuard` and `ProjectsService` to consult `ProjectMember` when the caller's org role is plain `MEMBER`. Gate project-member management (invite/role-change/remove) behind org-ADMIN+-OR-project-ADMIN+. Fix a pre-existing bug where inviting an unregistered email silently created a passwordless ghost user. Backfill existing orgs' projects via a hand-written Prisma migration so no current access is lost. Add a project members UI by generalizing the existing org members component.

**Tech Stack:** NestJS + Prisma + PostgreSQL (`apps/api`), Next.js App Router + Tailwind (`apps/web`), Jest for backend tests.

## Global Constraints

- Additive gate: org OWNER/ADMIN always access every project in their org; org MEMBER needs a `ProjectMember` row for that specific project.
- Project member management (invite/role-change/remove) requires org role ≥ ADMIN **OR** project role ≥ ADMIN. Viewing the member list only requires project access (no elevated role).
- `ProjectMembersService.create` must require an already-registered user (404 otherwise) — no more silent user creation on invite.
- The backfill migration must ship in the same deploy as the guard change, and must be idempotent.
- No changes to `OrganizationMember` behavior, Auth0/OAuth (separate phase), or Phase 9 hardening items.
- Spec: `docs/superpowers/specs/2026-07-17-project-members-access-enforcement-design.md`.

---

### Task 1: Export `ROLE_RANK` and rewire `ProjectAccessGuard` to enforce `ProjectMember`

**Files:**

- Modify: `apps/api/src/organizations/organizations.service.ts:17` (add `export` to the `ROLE_RANK` const)
- Modify: `apps/api/src/common/guards/project-access/project-access.guard.ts`
- Test: `apps/api/src/common/guards/project-access/project-access.guard.spec.ts`

**Interfaces:**

- Consumes: `ROLE_RANK: Record<ProjectMemberRole, number>` (values `OWNER: 3, ADMIN: 2, MEMBER: 1`), exported from `organizations.service.ts`.
- Produces: `ProjectAccessGuard.canActivate` behavior — passes for super-admin, org OWNER/ADMIN unconditionally; for org MEMBER, requires a `ProjectMember` row for `(projectId, userId)`. Nothing else in this codebase currently imports `ProjectAccessGuard`'s internals, so no other task depends on its shape beyond this behavior.

- [ ] **Step 1: Export `ROLE_RANK`**

In `apps/api/src/organizations/organizations.service.ts`, change:

```ts
const ROLE_RANK: Record<ProjectMemberRole, number> = {
```

to:

```ts
export const ROLE_RANK: Record<ProjectMemberRole, number> = {
```

- [ ] **Step 2: Write the failing tests**

Replace the full contents of `apps/api/src/common/guards/project-access/project-access.guard.spec.ts` with:

```ts
import { ExecutionContext, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../../../generated/prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ProjectAccessGuard } from "./project-access.guard";

function contextFor(request: unknown): ExecutionContext {
    return {
        switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
}

describe("ProjectAccessGuard", () => {
    let guard: ProjectAccessGuard;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            organizationMember: { findUnique: jest.Mock };
            projectMember: { findUnique: jest.Mock };
        };
    };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                organizationMember: { findUnique: jest.fn() },
                projectMember: { findUnique: jest.fn() },
            },
        };
        guard = new ProjectAccessGuard(prismaService as unknown as PrismaService);
    });

    it("bypasses membership for a super-admin", async () => {
        await expect(guard.canActivate(contextFor({ isSuperAdmin: true, params: { projectId: "p1" } }))).resolves.toBe(
            true,
        );
        expect(prismaService.client.project.findUnique).not.toHaveBeenCalled();
    });

    it("allows an org OWNER/ADMIN without a ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "p1" } })),
        ).resolves.toBe(true);
        expect(prismaService.client.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it("allows an org MEMBER with a matching ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.projectMember.findUnique.mockResolvedValue({ id: "pm_1" });

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "p1" } })),
        ).resolves.toBe(true);
        expect(prismaService.client.projectMember.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { projectId_userId: { projectId: "p1", userId: "user_1" } },
            }),
        );
    });

    it("rejects an org MEMBER without a ProjectMember row", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
        prismaService.client.projectMember.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_2", params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects a non-member of the organization", async () => {
        prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
        prismaService.client.organizationMember.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, authUserId: "user_3", params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns 404 for a missing project", async () => {
        prismaService.client.project.findUnique.mockResolvedValue(null);

        await expect(
            guard.canActivate(
                contextFor({ isSuperAdmin: false, authUserId: "user_1", params: { projectId: "missing" } }),
            ),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects when there is no authenticated user", async () => {
        await expect(
            guard.canActivate(contextFor({ isSuperAdmin: false, params: { projectId: "p1" } })),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --dir apps/api test -- project-access.guard.spec.ts`
Expected: FAIL — the "allows an org OWNER/ADMIN" and "allows an org MEMBER with a matching row" cases fail because the current guard only checks `organizationMember.findUnique` existence, not role, and never touches `projectMember`.

- [ ] **Step 4: Implement the guard**

Replace the full contents of `apps/api/src/common/guards/project-access/project-access.guard.ts` with:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { DashboardAuthRequest } from "../../interfaces/dashboard-auth-request";
import { PrismaService } from "../../../prisma/prisma.service";
import { ProjectMemberRole } from "../../../generated/prisma/client";
import { ROLE_RANK } from "../../../organizations/organizations.service";

/**
 * Authorizes access to a `projects/:projectId/...` route. Must run after
 * `DashboardAuthGuard` (which sets `isSuperAdmin` / `authUserId`). Super-admins
 * bypass. Org OWNER/ADMIN have access to every project in their org. Org MEMBER
 * needs an explicit `ProjectMember` row for this specific project.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
    constructor(private readonly prismaService: PrismaService) {}

    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<DashboardAuthRequest>();

        if (request.isSuperAdmin) {
            return true;
        }

        const userId = request.authUserId;
        const projectId = request.params?.projectId;

        if (!userId || typeof projectId !== "string") {
            throw new ForbiddenException("You do not have access to this project");
        }

        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { role: true },
        });

        if (!orgMembership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        if (ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return true;
        }

        const projectMembership = await this.prismaService.client.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId } },
            select: { id: true },
        });

        if (!projectMembership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        return true;
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- project-access.guard.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/organizations/organizations.service.ts apps/api/src/common/guards/project-access/project-access.guard.ts apps/api/src/common/guards/project-access/project-access.guard.spec.ts
git commit -m "feat(api): enforce ProjectMember access gate in ProjectAccessGuard"
```

---

### Task 2: Scope `ProjectsService.findAll` to accessible projects

**Files:**

- Modify: `apps/api/src/projects/projects.service.ts` (`findAll` method)
- Test: `apps/api/src/projects/projects.service.spec.ts`

**Interfaces:**

- Consumes: `ProjectMemberRole` enum (already imported in this file).
- Produces: `ProjectsService.findAll(context: DashboardAuthContext)` — same signature, new `where` clause. No other task depends on this method's internals.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/projects/projects.service.spec.ts`, replace the `"scopes the project list to the caller's organizations"` test with:

```ts
it("scopes the project list to orgs where the caller is OWNER/ADMIN or projects they're a member of", () => {
    prismaService.client.project.findMany.mockResolvedValue([]);

    void service.findAll(userContext);

    expect(prismaService.client.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            where: {
                OR: [
                    {
                        organization: {
                            members: {
                                some: {
                                    userId: "user_1",
                                    role: { in: [ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN] },
                                },
                            },
                        },
                    },
                    { members: { some: { userId: "user_1" } } },
                ],
            },
        }),
    );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/api test -- projects.service.spec.ts -t "scopes the project list"`
Expected: FAIL — current `where` is `{ organization: { members: { some: { userId } } } }`, not the new `OR` shape.

- [ ] **Step 3: Implement**

In `apps/api/src/projects/projects.service.ts`, replace the `findAll` method:

```ts
    findAll(context: DashboardAuthContext) {
        return this.prismaService.client.project.findMany({
            where: context.isSuperAdmin
                ? {}
                : {
                      OR: [
                          {
                              organization: {
                                  members: {
                                      some: {
                                          userId: context.authUserId,
                                          role: { in: [ProjectMemberRole.OWNER, ProjectMemberRole.ADMIN] },
                                      },
                                  },
                              },
                          },
                          { members: { some: { userId: context.authUserId } } },
                      ],
                  },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                slug: true,
                defaultRegion: true,
                createdAt: true,
                organization: { select: { id: true, name: true, slug: true } },
            },
        });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- projects.service.spec.ts`
Expected: PASS (all tests in this file, including the unrelated "returns every project for a super-admin" case, which is unaffected).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/projects.service.ts apps/api/src/projects/projects.service.spec.ts
git commit -m "feat(api): scope project list to projects the caller can access"
```

---

### Task 3: Enforce `ProjectMember` access in `ProjectsService.findOne`

**Files:**

- Modify: `apps/api/src/projects/projects.service.ts` (`findOne` method, add a private `assertProjectAccess` helper)
- Test: `apps/api/src/projects/projects.service.spec.ts`

**Interfaces:**

- Consumes: `ROLE_RANK` from `../organizations/organizations.service` (exported in Task 1).
- Produces: `ProjectsService.findOne` now throws `ForbiddenException` for an org MEMBER with no matching `ProjectMember` row, instead of allowing any org member through.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/projects/projects.service.spec.ts`, update the top imports to add `ForbiddenException`:

```ts
import { ForbiddenException, NotFoundException } from "@nestjs/common";
```

Add `organizationMember: { findUnique: jest.Mock }` to the `prismaService.client` mock shape and its `beforeEach` initialization:

```ts
let prismaService: {
    client: {
        project: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
        organizationMember: { findUnique: jest.Mock };
    };
};
```

```ts
prismaService = {
    client: {
        project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
        organizationMember: { findUnique: jest.fn() },
    },
};
```

Update the `"asserts access and sanitizes webhook secrets from project detail responses"` test to mock an org ADMIN (so it keeps passing through the new check) and drop the now-removed `organizationsService.assertAccess` assertion for this path:

```ts
it("asserts access and sanitizes webhook secrets from project detail responses", async () => {
    prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
    prismaService.client.project.findUnique.mockResolvedValue({
        id: "project_1",
        name: "Arena",
        slug: "arena",
        defaultRegion: null,
        organizationId: "org_1",
        createdAt: new Date("2026-06-12T00:00:00.000Z"),
        updatedAt: new Date("2026-06-12T00:00:00.000Z"),
        organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
        environments: [],
        members: [],
        webhookEndpoints: [
            {
                id: "wh_1",
                url: "https://example.com/hook",
                events: ["match.created"],
                secret: "super-secret",
                isActive: true,
                createdAt: new Date("2026-06-12T00:00:00.000Z"),
                updatedAt: new Date("2026-06-12T00:00:00.000Z"),
            },
        ],
    });

    const project = await service.findOne(userContext, "project_1");

    expect(prismaService.client.organizationMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
            where: { organizationId_userId: { organizationId: "org_1", userId: "user_1" } },
        }),
    );
    expect(project.webhookEndpoints[0]).toEqual(expect.objectContaining({ id: "wh_1", hasSecret: true }));
    expect(project.webhookEndpoints[0]).not.toHaveProperty("secret");
});
```

Add two new tests directly after it:

```ts
it("allows an org MEMBER who is a project member", async () => {
    prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
    prismaService.client.project.findUnique.mockResolvedValue({
        id: "project_1",
        name: "Arena",
        slug: "arena",
        defaultRegion: null,
        organizationId: "org_1",
        createdAt: new Date("2026-06-12T00:00:00.000Z"),
        updatedAt: new Date("2026-06-12T00:00:00.000Z"),
        organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
        environments: [],
        members: [
            {
                id: "pm_1",
                role: ProjectMemberRole.MEMBER,
                createdAt: new Date(),
                userId: "user_1",
                user: { id: "user_1", email: "a@b.com", name: null },
            },
        ],
        webhookEndpoints: [],
    });

    await expect(service.findOne(userContext, "project_1")).resolves.toEqual(
        expect.objectContaining({ id: "project_1" }),
    );
});

it("rejects an org MEMBER with no matching ProjectMember row", async () => {
    prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
    prismaService.client.project.findUnique.mockResolvedValue({
        id: "project_1",
        name: "Arena",
        slug: "arena",
        defaultRegion: null,
        organizationId: "org_1",
        createdAt: new Date("2026-06-12T00:00:00.000Z"),
        updatedAt: new Date("2026-06-12T00:00:00.000Z"),
        organization: { id: "org_1", name: "Arena Studio", slug: "arena-studio" },
        environments: [],
        members: [
            {
                id: "pm_2",
                role: ProjectMemberRole.MEMBER,
                createdAt: new Date(),
                userId: "someone_else",
                user: { id: "someone_else", email: "c@d.com", name: null },
            },
        ],
        webhookEndpoints: [],
    });

    await expect(service.findOne(userContext, "project_1")).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir apps/api test -- projects.service.spec.ts`
Expected: FAIL — `findOne` still calls `organizationsService.assertAccess` (which the updated mock no longer configures usefully) and never checks `organizationMember`/project members for the MEMBER-role cases.

- [ ] **Step 3: Implement**

In `apps/api/src/projects/projects.service.ts`, add `ForbiddenException` to the imports:

```ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
```

Import `ROLE_RANK`:

```ts
import { ROLE_RANK } from "../organizations/organizations.service";
```

Replace the `findOne` method and add the new private helper:

```ts
    async findOne(context: DashboardAuthContext, projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            include: {
                organization: true,
                environments: { orderBy: { name: "asc" } },
                members: {
                    include: { user: { select: { id: true, email: true, name: true } } },
                },
                webhookEndpoints: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        await this.assertProjectAccess(context, project.organizationId, project.members);

        return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            defaultRegion: project.defaultRegion,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            organization: project.organization,
            environments: project.environments,
            members: project.members.map((member) => ({
                id: member.id,
                role: member.role,
                createdAt: member.createdAt,
                user: member.user,
            })),
            webhookEndpoints: project.webhookEndpoints.map((webhook) => ({
                id: webhook.id,
                url: webhook.url,
                events: webhook.events,
                isActive: webhook.isActive,
                createdAt: webhook.createdAt,
                updatedAt: webhook.updatedAt,
                hasSecret: true,
            })),
        };
    }

    private async assertProjectAccess(
        context: DashboardAuthContext,
        organizationId: string,
        projectMembers: { userId: string }[],
    ) {
        if (context.isSuperAdmin) {
            return;
        }

        const userId = context.authUserId;
        if (!userId) {
            throw new ForbiddenException("You do not have access to this project");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId, userId } },
            select: { role: true },
        });

        if (!orgMembership) {
            throw new ForbiddenException("You do not have access to this project");
        }

        if (ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return;
        }

        if (!projectMembers.some((member) => member.userId === userId)) {
            throw new ForbiddenException("You do not have access to this project");
        }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- projects.service.spec.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/projects.service.ts apps/api/src/projects/projects.service.spec.ts
git commit -m "feat(api): enforce ProjectMember access in ProjectsService.findOne"
```

---

### Task 4: Gate project-member management and fix the ghost-user invite bug

**Files:**

- Modify: `apps/api/src/projects/dto/create-project-member.dto.ts` (drop unused `name` field)
- Modify: `apps/api/src/projects/project-members.service.ts`
- Modify: `apps/api/src/projects/project-members.controller.ts`
- Test: `apps/api/src/projects/project-members.service.spec.ts`

**Interfaces:**

- Consumes: `ROLE_RANK` from `../organizations/organizations.service`; `DashboardAuthContext`/`toDashboardContext` from `../common/interfaces/dashboard-auth-request`.
- Produces: `ProjectMembersService.create(context, projectId, dto)`, `.update(context, projectId, memberId, dto)`, `.remove(context, projectId, memberId)` — all now take `context` as the first parameter. `.findAll(projectId)` is unchanged (view-only, already gated by `ProjectAccessGuard` at the controller level). This is the shape Task 8 (frontend) assumes when calling these routes indirectly through the API — no frontend code calls the service directly, so this only affects the controller in this task.

- [ ] **Step 1: Drop the unused `name` field from the DTO**

Replace `apps/api/src/projects/dto/create-project-member.dto.ts` with:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, MaxLength } from "class-validator";
import { ProjectMemberRole } from "../../generated/prisma/client";

export class CreateProjectMemberDto {
    @ApiProperty({ description: "The invitee must already be registered.", maxLength: 160 })
    @IsEmail()
    @MaxLength(160)
    email!: string;

    @ApiProperty({ enum: ProjectMemberRole })
    @IsEnum(ProjectMemberRole)
    role!: ProjectMemberRole;
}
```

- [ ] **Step 2: Write the failing tests**

Replace the full contents of `apps/api/src/projects/project-members.service.spec.ts` with:

```ts
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectMembersService } from "./project-members.service";

describe("ProjectMembersService", () => {
    let service: ProjectMembersService;
    let prismaService: {
        client: {
            project: { findUnique: jest.Mock };
            organizationMember: { findUnique: jest.Mock };
            user: { findUnique: jest.Mock };
            projectMember: {
                findMany: jest.Mock;
                findUnique: jest.Mock;
                findFirst: jest.Mock;
                create: jest.Mock;
                update: jest.Mock;
                delete: jest.Mock;
                count: jest.Mock;
            };
        };
    };

    const adminContext = { authUserId: "admin_1", isSuperAdmin: false };

    beforeEach(() => {
        prismaService = {
            client: {
                project: { findUnique: jest.fn() },
                organizationMember: { findUnique: jest.fn() },
                user: { findUnique: jest.fn() },
                projectMember: {
                    findMany: jest.fn(),
                    findUnique: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                    count: jest.fn(),
                },
            },
        };

        service = new ProjectMembersService(prismaService as unknown as PrismaService);
    });

    describe("create", () => {
        beforeEach(() => {
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
        });

        it("creates a project member for an already-registered user", async () => {
            prismaService.client.user.findUnique.mockResolvedValue({
                id: "user_1",
                email: "member@example.com",
                name: "Member",
            });
            prismaService.client.projectMember.findUnique.mockResolvedValue(null);
            prismaService.client.projectMember.create.mockResolvedValue({
                id: "member_1",
                role: ProjectMemberRole.ADMIN,
                createdAt: new Date("2026-06-12T00:00:00.000Z"),
                user: { id: "user_1", email: "member@example.com", name: "Member" },
            });

            const created = await service.create(adminContext, "project_1", {
                email: "member@example.com",
                role: ProjectMemberRole.ADMIN,
            });

            expect(created.role).toBe(ProjectMemberRole.ADMIN);
            expect(prismaService.client.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({ where: { email: "member@example.com" } }),
            );
            expect(prismaService.client.projectMember.create).toHaveBeenCalled();
        });

        it("rejects invites for an email with no registered account", async () => {
            prismaService.client.user.findUnique.mockResolvedValue(null);

            await expect(
                service.create(adminContext, "project_1", {
                    email: "nobody@example.com",
                    role: ProjectMemberRole.MEMBER,
                }),
            ).rejects.toBeInstanceOf(NotFoundException);
            expect(prismaService.client.projectMember.create).not.toHaveBeenCalled();
        });
    });

    describe("remove", () => {
        it("prevents removing the last project owner", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findFirst.mockResolvedValue({
                id: "member_1",
                projectId: "project_1",
                role: ProjectMemberRole.OWNER,
                user: { id: "user_1", email: "owner@example.com", name: "Owner" },
            });
            prismaService.client.projectMember.count.mockResolvedValue(1);

            await expect(service.remove(adminContext, "project_1", "member_1")).rejects.toBeInstanceOf(
                ConflictException,
            );
            expect(prismaService.client.projectMember.delete).not.toHaveBeenCalled();
        });

        it("allows a caller who is a project ADMIN without an elevated org role", async () => {
            const projectAdminContext = { authUserId: "project_admin_1", isSuperAdmin: false };
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.projectMember.findFirst.mockResolvedValue({
                id: "member_2",
                projectId: "project_1",
                role: ProjectMemberRole.MEMBER,
                user: { id: "user_2", email: "member@example.com", name: null },
            });

            await expect(service.remove(projectAdminContext, "project_1", "member_2")).resolves.toEqual(
                expect.objectContaining({ id: "member_2", removed: true }),
            );
        });

        it("rejects a caller who is neither an org admin nor a project admin", async () => {
            const plainMemberContext = { authUserId: "user_3", isSuperAdmin: false };
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.MEMBER });

            await expect(service.remove(plainMemberContext, "project_1", "member_2")).rejects.toBeInstanceOf(
                ForbiddenException,
            );
            expect(prismaService.client.projectMember.delete).not.toHaveBeenCalled();
        });
    });

    describe("update", () => {
        it("fails when project member does not exist", async () => {
            prismaService.client.organizationMember.findUnique.mockResolvedValue({ role: ProjectMemberRole.ADMIN });
            prismaService.client.project.findUnique.mockResolvedValue({ organizationId: "org_1" });
            prismaService.client.projectMember.findFirst.mockResolvedValue(null);

            await expect(
                service.update(adminContext, "project_1", "member_missing", { role: ProjectMemberRole.ADMIN }),
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --dir apps/api test -- project-members.service.spec.ts`
Expected: FAIL — current methods don't accept a `context` parameter, `create` still calls `user.upsert`, and there is no `assertManageAccess` check.

- [ ] **Step 4: Implement the service**

Replace the full contents of `apps/api/src/projects/project-members.service.ts` with:

```ts
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectMemberRole } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ROLE_RANK } from "../organizations/organizations.service";
import type { DashboardAuthContext } from "../common/interfaces/dashboard-auth-request";
import { CreateProjectMemberDto } from "./dto/create-project-member.dto";
import { UpdateProjectMemberDto } from "./dto/update-project-member.dto";

@Injectable()
export class ProjectMembersService {
    constructor(private readonly prismaService: PrismaService) {}

    async findAll(projectId: string) {
        await this.ensureProjectExists(projectId);

        const members = await this.prismaService.client.projectMember.findMany({
            where: {
                projectId,
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return members.map((member) => ({
            id: member.id,
            role: member.role,
            createdAt: member.createdAt,
            user: member.user,
        }));
    }

    async create(context: DashboardAuthContext, projectId: string, createProjectMemberDto: CreateProjectMemberDto) {
        await this.assertManageAccess(context, projectId);

        const user = await this.prismaService.client.user.findUnique({
            where: { email: createProjectMemberDto.email.toLowerCase() },
            select: { id: true, email: true, name: true },
        });

        if (!user) {
            throw new NotFoundException("No registered user with that email; ask them to sign up first");
        }

        const existing = await this.prismaService.client.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: user.id,
                },
            },
        });

        if (existing) {
            throw new ConflictException("Project member already exists");
        }

        const member = await this.prismaService.client.projectMember.create({
            data: {
                projectId,
                userId: user.id,
                role: createProjectMemberDto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return {
            id: member.id,
            role: member.role,
            createdAt: member.createdAt,
            user: member.user,
        };
    }

    async update(
        context: DashboardAuthContext,
        projectId: string,
        memberId: string,
        updateProjectMemberDto: UpdateProjectMemberDto,
    ) {
        await this.assertManageAccess(context, projectId);

        const member = await this.getMember(projectId, memberId);

        if (member.role === ProjectMemberRole.OWNER && updateProjectMemberDto.role !== ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(projectId, member.id);
        }

        const updated = await this.prismaService.client.projectMember.update({
            where: {
                id: member.id,
            },
            data: {
                role: updateProjectMemberDto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        return {
            id: updated.id,
            role: updated.role,
            createdAt: updated.createdAt,
            user: updated.user,
        };
    }

    async remove(context: DashboardAuthContext, projectId: string, memberId: string) {
        await this.assertManageAccess(context, projectId);

        const member = await this.getMember(projectId, memberId);

        if (member.role === ProjectMemberRole.OWNER) {
            await this.assertNotLastOwner(projectId, member.id);
        }

        await this.prismaService.client.projectMember.delete({
            where: {
                id: member.id,
            },
        });

        return {
            id: member.id,
            deleted: true,
        };
    }

    /**
     * Requires org role >= ADMIN OR project role >= ADMIN. Super-admins bypass.
     */
    private async assertManageAccess(context: DashboardAuthContext, projectId: string) {
        if (context.isSuperAdmin) {
            return;
        }

        const userId = context.authUserId;
        if (!userId) {
            throw new ForbiddenException("You do not have permission to manage this project's members");
        }

        const project = await this.prismaService.client.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }

        const orgMembership = await this.prismaService.client.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            select: { role: true },
        });

        if (orgMembership && ROLE_RANK[orgMembership.role] >= ROLE_RANK[ProjectMemberRole.ADMIN]) {
            return;
        }

        const projectMembership = await this.prismaService.client.projectMember.findUnique({
            where: { projectId_userId: { projectId, userId } },
            select: { role: true },
        });

        if (!projectMembership || ROLE_RANK[projectMembership.role] < ROLE_RANK[ProjectMemberRole.ADMIN]) {
            throw new ForbiddenException("You do not have permission to manage this project's members");
        }
    }

    private async ensureProjectExists(projectId: string) {
        const project = await this.prismaService.client.project.findUnique({
            where: {
                id: projectId,
            },
            select: {
                id: true,
            },
        });

        if (!project) {
            throw new NotFoundException("Project not found");
        }
    }

    private async getMember(projectId: string, memberId: string) {
        const member = await this.prismaService.client.projectMember.findFirst({
            where: {
                id: memberId,
                projectId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });

        if (!member) {
            throw new NotFoundException("Project member not found");
        }

        return member;
    }

    private async assertNotLastOwner(projectId: string, memberId: string) {
        const ownerCount = await this.prismaService.client.projectMember.count({
            where: {
                projectId,
                role: ProjectMemberRole.OWNER,
            },
        });

        if (ownerCount <= 1) {
            throw new ConflictException("Project must keep at least one owner");
        }

        const currentOwner = await this.prismaService.client.projectMember.findFirst({
            where: {
                id: memberId,
                projectId,
                role: ProjectMemberRole.OWNER,
            },
            select: {
                id: true,
            },
        });

        if (!currentOwner) {
            throw new NotFoundException("Project member not found");
        }
    }
}
```

- [ ] **Step 5: Wire `context` through the controller**

Replace the full contents of `apps/api/src/projects/project-members.controller.ts` with:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardAuthGuard } from "../common/guards/dashboard-auth/dashboard-auth.guard";
import { ProjectAccessGuard } from "../common/guards/project-access/project-access.guard";
import { type DashboardAuthRequest, toDashboardContext } from "../common/interfaces/dashboard-auth-request";
import { SESSION_TOKEN_SECURITY } from "../swagger";
import { CreateProjectMemberDto } from "./dto/create-project-member.dto";
import { UpdateProjectMemberDto } from "./dto/update-project-member.dto";
import { ProjectMembersService } from "./project-members.service";

@ApiTags("Project Members")
@ApiBearerAuth(SESSION_TOKEN_SECURITY)
@UseGuards(DashboardAuthGuard, ProjectAccessGuard)
@Controller("projects/:projectId/members")
export class ProjectMembersController {
    constructor(private readonly projectMembersService: ProjectMembersService) {}

    @ApiOperation({ summary: "List project members." })
    @Get()
    findAll(@Param("projectId") projectId: string) {
        return this.projectMembersService.findAll(projectId);
    }

    @ApiOperation({ summary: "Add a project member. Requires org ADMIN+ or project ADMIN+." })
    @Post()
    create(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Body() createProjectMemberDto: CreateProjectMemberDto,
    ) {
        return this.projectMembersService.create(toDashboardContext(request), projectId, createProjectMemberDto);
    }

    @ApiOperation({ summary: "Change a project member's role. Requires org ADMIN+ or project ADMIN+." })
    @Patch(":memberId")
    update(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("memberId") memberId: string,
        @Body() updateProjectMemberDto: UpdateProjectMemberDto,
    ) {
        return this.projectMembersService.update(
            toDashboardContext(request),
            projectId,
            memberId,
            updateProjectMemberDto,
        );
    }

    @ApiOperation({
        summary: "Remove a member. Requires org ADMIN+ or project ADMIN+; a project must keep at least one owner.",
    })
    @Delete(":memberId")
    remove(
        @Req() request: DashboardAuthRequest,
        @Param("projectId") projectId: string,
        @Param("memberId") memberId: string,
    ) {
        return this.projectMembersService.remove(toDashboardContext(request), projectId, memberId);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --dir apps/api test -- project-members.service.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Run the full backend test suite**

Run: `pnpm --dir apps/api test`
Expected: PASS (no regressions in unrelated suites).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/projects/dto/create-project-member.dto.ts apps/api/src/projects/project-members.service.ts apps/api/src/projects/project-members.controller.ts apps/api/src/projects/project-members.service.spec.ts
git commit -m "feat(api): gate project member management and fix ghost-user invite bug"
```

---

### Task 5: Backfill migration for existing org members

**Files:**

- Create: `apps/api/prisma/migrations/20260717010000_project_members_backfill/migration.sql`

**Interfaces:**

- Produces: a one-time, idempotent data migration that inserts a `ProjectMember` row (role = the user's current `OrganizationMember` role) for every `(project, org member)` pair that doesn't already have one. Runs via the existing CI `db_migrate` job (`prisma migrate deploy`), so it lands before the new guard behavior goes live in the same deploy — no other task depends on its output at test time, but it must exist before Task 1–4's guard changes reach production.

- [ ] **Step 1: Create an empty migration**

Run (requires a reachable `DATABASE_URL`, e.g. local dev Postgres via `pnpm docker:up`):

```bash
pnpm --dir apps/api exec prisma migrate dev --create-only --name project_members_backfill
```

Expected: creates `apps/api/prisma/migrations/<timestamp>_project_members_backfill/migration.sql`, empty except for a header comment. Rename the generated folder to `20260717010000_project_members_backfill` if the generated timestamp differs, so it sorts after `20260618100000_phase7_org_members`.

- [ ] **Step 2: Write the backfill SQL**

Replace the contents of `apps/api/prisma/migrations/20260717010000_project_members_backfill/migration.sql` with:

```sql
-- Backfill: give every organization member an explicit ProjectMember row on
-- every project in their organization, mirroring their current org role. This
-- is a one-time catch-up for the additive access gate added in
-- ProjectAccessGuard/ProjectsService — see
-- docs/superpowers/specs/2026-07-17-project-members-access-enforcement-design.md.
-- It does not keep future org members in sync with existing projects; new
-- members must be granted project access explicitly going forward.
INSERT INTO "project_members" ("id", "project_id", "user_id", "role", "created_at")
SELECT
    substr(md5(random()::text || clock_timestamp()::text || p.id || om.user_id), 1, 24),
    p.id,
    om.user_id,
    om.role,
    CURRENT_TIMESTAMP
FROM "projects" p
JOIN "organization_members" om ON om.organization_id = p.organization_id
WHERE NOT EXISTS (
    SELECT 1
    FROM "project_members" pm
    WHERE pm.project_id = p.id
      AND pm.user_id = om.user_id
);
```

- [ ] **Step 3: Apply and verify locally**

Run: `pnpm --dir apps/api prisma:migrate:dev`
Expected: migration applies cleanly. Then verify idempotency by running it again:

Run: `pnpm --dir apps/api exec prisma migrate deploy`
Expected: no error, no new rows inserted (the `NOT EXISTS` clause makes re-running a no-op).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/migrations/20260717010000_project_members_backfill
git commit -m "feat(api): backfill ProjectMember rows for existing org members"
```

---

### Task 6: Generalize the member-management server actions for org and project scopes

**Files:**

- Modify: `apps/web/lib/actions.ts` (`inviteMember`, `updateMemberRole`, `removeMember`)

**Interfaces:**

- Produces: `inviteMember`, `updateMemberRole`, `removeMember` now read either an `organizationId` or a `projectId` field from the submitted `FormData` and hit `/organizations/:id/members...` or `/projects/:id/members...` accordingly. Task 7's `MembersManager` component relies on this: it must submit a hidden field named `organizationId` or `projectId` (never both) matching the `scope` prop it's given.

- [ ] **Step 1: Implement the scope-aware helper and update the three actions**

In `apps/web/lib/actions.ts`, add this helper near the top of the file (after existing imports, before its first use — place it directly above `inviteMember`):

```ts
type MemberScope = "organizations" | "projects";

function memberScopeFromForm(formData: FormData): { scope: MemberScope; scopeId: string } {
    const organizationId = String(formData.get("organizationId") ?? "");
    if (organizationId) {
        return { scope: "organizations", scopeId: organizationId };
    }
    return { scope: "projects", scopeId: String(formData.get("projectId") ?? "") };
}

function memberScopePath(scope: MemberScope, scopeId: string): string {
    return scope === "organizations" ? `/dashboard/organizations/${scopeId}` : `/dashboard/projects/${scopeId}`;
}
```

Replace `inviteMember`, `updateMemberRole`, and `removeMember` with:

```ts
export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "MEMBER");

    if (!email) {
        return { error: "Email is required" };
    }

    try {
        await apiFetch(`/${scope}/${scopeId}/members`, {
            method: "POST",
            body: JSON.stringify({ email, role }),
        });
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return { error: "No account with that email — ask them to sign up first" };
        }
        return { error: humanize(error) };
    }

    revalidatePath(memberScopePath(scope, scopeId));
    return {};
}

export async function updateMemberRole(formData: FormData): Promise<void> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const memberId = String(formData.get("memberId") ?? "");
    const role = String(formData.get("role") ?? "MEMBER");
    await apiFetch(`/${scope}/${scopeId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
    }).catch(() => undefined);
    revalidatePath(memberScopePath(scope, scopeId));
}

export async function removeMember(formData: FormData): Promise<void> {
    const { scope, scopeId } = memberScopeFromForm(formData);
    const memberId = String(formData.get("memberId") ?? "");
    await apiFetch(`/${scope}/${scopeId}/members/${memberId}`, { method: "DELETE" }).catch(() => undefined);
    revalidatePath(memberScopePath(scope, scopeId));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --dir apps/web typecheck`
Expected: PASS (no consumers of the old signatures are broken yet — `MembersManager` still only submits `organizationId`, which the new `memberScopeFromForm` still handles correctly).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/actions.ts
git commit -m "feat(web): make member-management actions scope-aware (org or project)"
```

---

### Task 7: Generalize `MembersManager` to accept an org or project scope

**Files:**

- Modify: `apps/web/components/members-manager.tsx`
- Modify: `apps/web/app/dashboard/organizations/[orgId]/page.tsx` (update the one existing call site)

**Interfaces:**

- Consumes: `inviteMember`, `updateMemberRole`, `removeMember` from Task 6 (already scope-aware).
- Produces: `MembersManager({ scope: "organizations" | "projects", scopeId: string, members: Member[], canManage: boolean })`. Task 8 renders this with `scope="projects"`.

- [ ] **Step 1: Update the component**

Replace the full contents of `apps/web/components/members-manager.tsx` with:

```tsx
"use client";

import { useActionState } from "react";
import { type FormState, inviteMember, removeMember, updateMemberRole } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";

type Member = {
    id: string;
    role: string;
    user: { id: string; email: string; name: string | null };
};

type MemberScope = "organizations" | "projects";

const ROLES = ["OWNER", "ADMIN", "MEMBER"];
const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:text-sm";

const initialState: FormState = {};

export function MembersManager({
    scope,
    scopeId,
    members,
    canManage,
}: {
    scope: MemberScope;
    scopeId: string;
    members: Member[];
    canManage: boolean;
}) {
    const [state, action, pending] = useActionState(inviteMember, initialState);
    const scopeFieldName = scope === "organizations" ? "organizationId" : "projectId";

    return (
        <div className="space-y-4">
            {canManage ? (
                <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input type="hidden" name={scopeFieldName} value={scopeId} />
                    <Input name="email" type="email" placeholder="teammate@example.com" className="flex-1" required />
                    <select name="role" defaultValue="MEMBER" className={selectClass} aria-label="Role">
                        {ROLES.map((role) => (
                            <option key={role} value={role}>
                                {role.toLowerCase()}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" disabled={pending}>
                        {pending ? "Inviting…" : "Invite"}
                    </Button>
                </form>
            ) : null}

            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

            <ul className="divide-y">
                {members.map((member) => (
                    <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                            <p className="truncate text-sm">{member.user.name ?? member.user.email}</p>
                            <p className="truncate font-mono text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                        {canManage ? (
                            <div className="flex shrink-0 items-center gap-1">
                                <form action={updateMemberRole} className="flex items-center gap-1">
                                    <input type="hidden" name={scopeFieldName} value={scopeId} />
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <select
                                        name="role"
                                        defaultValue={member.role}
                                        className={selectClass}
                                        aria-label="Member role"
                                    >
                                        {ROLES.map((role) => (
                                            <option key={role} value={role}>
                                                {role.toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                    <Button type="submit" variant="ghost" size="sm">
                                        Save
                                    </Button>
                                </form>
                                <form action={removeMember}>
                                    <input type="hidden" name={scopeFieldName} value={scopeId} />
                                    <input type="hidden" name="memberId" value={member.id} />
                                    <ConfirmButton confirmLabel="Remove member">Remove</ConfirmButton>
                                </form>
                            </div>
                        ) : (
                            <Badge variant="secondary">{member.role.toLowerCase()}</Badge>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

- [ ] **Step 2: Update the organization page call site**

In `apps/web/app/dashboard/organizations/[orgId]/page.tsx`, change:

```tsx
<MembersManager organizationId={organization.id} members={members} canManage={canManage} />
```

to:

```tsx
<MembersManager scope="organizations" scopeId={organization.id} members={members} canManage={canManage} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --dir apps/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/members-manager.tsx "apps/web/app/dashboard/organizations/[orgId]/page.tsx"
git commit -m "refactor(web): generalize MembersManager to org or project scope"
```

---

### Task 8: Add the Members card to the project detail page

**Files:**

- Modify: `apps/web/lib/api.ts` (add `ProjectMember` and `ProjectDetail` types)
- Modify: `apps/web/app/dashboard/projects/[projectId]/page.tsx`

**Interfaces:**

- Consumes: `MembersManager` (Task 7), `getCurrentUser()` (existing), `GET /projects/:projectId` (existing `ProjectsService.findOne` response, unchanged shape from Task 3).
- Produces: nothing further consumes this — it's the last functional task.

- [ ] **Step 1: Add frontend types for the project detail response**

In `apps/web/lib/api.ts`, directly after the existing `export type Project = { ... };` block, add:

```ts
export type ProjectMember = {
    id: string;
    role: string;
    createdAt: string;
    user: { id: string; email: string; name: string | null };
};

export type ProjectDetail = {
    id: string;
    name: string;
    slug: string;
    defaultRegion: string | null;
    createdAt: string;
    updatedAt: string;
    organization: { id: string; name: string; slug: string };
    members: ProjectMember[];
};
```

- [ ] **Step 2: Fetch project detail and the current user, compute `canManage`**

In `apps/web/app/dashboard/projects/[projectId]/page.tsx`, add `ProjectDetail` and `getCurrentUser` to the existing `@/lib/api` import:

```ts
import {
    ApiError,
    apiFetch,
    getCurrentUser,
    type ApiKey,
    type Delivery,
    type Environment,
    type MatchSummary,
    type Paginated,
    type Pool,
    type ProjectDetail,
    type RatingHistoryEntry,
    type Webhook as WebhookEndpoint,
} from "@/lib/api";
```

Add the `MembersManager` import next to the other manager component imports:

```ts
import { MembersManager } from "@/components/members-manager";
```

Add `project` and `me` to the destructured variables and the `Promise.all` call:

```ts
let project: ProjectDetail;
let me: Awaited<ReturnType<typeof getCurrentUser>>;
let environments: Environment[];
let apiKeys: ApiKey[];
let webhooks: WebhookEndpoint[];
let pools: Pool[];
let matches7d: Paginated<MatchSummary>;
let completed7d: Paginated<MatchSummary>;
let recentMatches: Paginated<MatchSummary>;
let deliveriesAll: Paginated<Delivery>;
let deliveriesDelivered: Paginated<Delivery>;
let ratings: Paginated<RatingHistoryEntry>;
try {
    [
        project,
        me,
        environments,
        apiKeys,
        webhooks,
        pools,
        matches7d,
        completed7d,
        recentMatches,
        deliveriesAll,
        deliveriesDelivered,
        ratings,
    ] = await Promise.all([
        apiFetch<ProjectDetail>(`/projects/${projectId}`),
        getCurrentUser(),
        apiFetch<Environment[]>(`/projects/${projectId}/environments`),
        apiFetch<ApiKey[]>(`/projects/${projectId}/api-keys`),
        apiFetch<WebhookEndpoint[]>(`/projects/${projectId}/webhooks`),
        apiFetch<Pool[]>(`/projects/${projectId}/pools`),
        apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since7d}&limit=1`),
        apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since7d}&status=COMPLETED&limit=1`),
        apiFetch<Paginated<MatchSummary>>(`/projects/${projectId}/matches?from=${since14d}&limit=100`),
        apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?limit=1`),
        apiFetch<Paginated<Delivery>>(`/projects/${projectId}/webhook-deliveries?status=DELIVERED&limit=1`),
        apiFetch<Paginated<RatingHistoryEntry>>(`/projects/${projectId}/rating-history?limit=1`),
    ]);
} catch (error) {
    if (error instanceof ApiError && error.status === 404) {
        notFound();
    }
    throw error;
}

const orgRole = me.organizations.find((organization) => organization.id === project.organization.id)?.role;
const myProjectRole = project.members.find((member) => member.user.id === me.id)?.role;
const canManageMembers =
    orgRole === "OWNER" || orgRole === "ADMIN" || myProjectRole === "OWNER" || myProjectRole === "ADMIN";
```

- [ ] **Step 3: Render the Members card**

In the same file, the returned JSX currently ends with the Webhooks card closing the `lg:grid-cols-2` grid:

```tsx
                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Webhooks</CardTitle>
                        <CardDescription>{webhooks.length} endpoints</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WebhooksManager projectId={projectId} webhooks={webhooks} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
```

Replace that block with (adding the Members card as a sibling _after_ the grid closes, not inside it):

```tsx
                <Card className="min-w-0 lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Webhooks</CardTitle>
                        <CardDescription>{webhooks.length} endpoints</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <WebhooksManager projectId={projectId} webhooks={webhooks} />
                    </CardContent>
                </Card>
            </div>

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>{project.members.length} in this project</CardDescription>
                </CardHeader>
                <CardContent>
                    <MembersManager
                        scope="projects"
                        scopeId={project.id}
                        members={project.members}
                        canManage={canManageMembers}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --dir apps/web typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `pnpm --dir apps/web dev` (with the API running against a dev database that has run the Task 5 migration), then in a browser:

1. Log in as an org OWNER, open a project, confirm the Members card shows and allows invite/role-change/remove.
2. Log in as a plain org MEMBER who has a `ProjectMember` row for that project — confirm the project loads and the Members card is read-only (no invite form, badges instead of controls).
3. Manually remove that MEMBER's `ProjectMember` row via `prisma studio` (`pnpm --dir apps/api prisma:studio`) and confirm they now get a 403/not-found when opening that project.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/api.ts "apps/web/app/dashboard/projects/[projectId]/page.tsx"
git commit -m "feat(web): add project members management to the project detail page"
```

---

### Task 9: Roadmap docs

**Files:**

- Create: `docs/roadmap/phase-13-project-members-enforcement.md`
- Modify: `docs/roadmap/backlog.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Create the phase doc**

Create `docs/roadmap/phase-13-project-members-enforcement.md`:

```markdown
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
```

- [ ] **Step 2: Update the backlog**

In `docs/roadmap/backlog.md`, remove the line `- [ ] Per-project member roles enforced distinctly from org roles` from the "Auth and Platform" section, and add a note under "Notes":

```markdown
- Per-project member roles graduated to
  [`phase-13-project-members-enforcement.md`](phase-13-project-members-enforcement.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/roadmap/phase-13-project-members-enforcement.md docs/roadmap/backlog.md
git commit -m "docs: graduate project member enforcement to Phase 13"
```

---

### Task 10: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Full backend test suite**

Run: `pnpm --dir apps/api test`
Expected: PASS, no regressions.

- [ ] **Step 2: Backend lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Frontend typecheck**

Run: `pnpm --dir apps/web typecheck`
Expected: PASS.

- [ ] **Step 4: Regenerate the OpenAPI spec**

Run: `pnpm --dir apps/api openapi:generate` (with `DATABASE_URL`, `DASHBOARD_ADMIN_TOKEN`, `SESSION_SECRET` set to any value per `AGENTS.md`)
Expected: `docs/openapi.json` updates to reflect the new `ApiOperation` summaries on the project-members endpoints; commit the diff if any.

```bash
git add docs/openapi.json
git commit -m "chore: regenerate OpenAPI spec for project members enforcement" --allow-empty
```

(Use `--allow-empty` only if `git status` shows no changes to `docs/openapi.json` and you still want a marker commit; otherwise omit `--allow-empty` and skip the commit if there's nothing staged.)

- [ ] **Step 5: End-to-end manual smoke test**

Follow Task 8 Step 5 in full against a local Postgres with the Task 5 migration applied, covering all three scenarios (org owner, project member, revoked project member).

```

```
