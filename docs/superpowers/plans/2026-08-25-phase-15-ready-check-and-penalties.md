# Phase 15: Match Ready Check Handshake & Player Dodge Penalties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement interactive Ready Check (Accept/Decline handshake) for match formation, automated BullMQ timeout processing, priority re-queuing for innocent players, studio-configurable progressive dodge penalties, and operator dashboard moderation tooling.

**Architecture:**

- **Match State Machine:** `PENDING_ACCEPTANCE` -> `CONFIRMED` / `DECLINED` / `CANCELLED`.
- **BullMQ Delayed Queue:** `ready-check-timeout` queue for non-blocking timeout handling.
- **Priority Re-queue:** In-place status revert of `QueueEntry.status` to `QUEUED` with preserved `queuedAt` timestamp and immediate prioritized pool sweep.
- **Player Penalties:** `PlayerPenalty` model with configurable `penaltyTiers` and decay window per Project; Enqueue guard rejection with `403 PLAYER_IN_COOLDOWN`.
- **Operator Dashboard:** Next.js UI for GameMode Ready Check settings, Project penalty policy, and Penalties Moderation management.

**Tech Stack:** NestJS, Prisma, PostgreSQL 17, BullMQ, Redis 7, Next.js App Router, Tailwind CSS, Jest.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-15-ready-check-and-penalties-design.md`

## Global Constraints

- Backwards compatibility: Existing GameModes (`enableReadyCheck: false`) must retain immediate `CREATED` flow and zero breaking changes for existing game servers.
- Database remains durable source of truth; BullMQ handles timing orchestration.
- State transitions from `PENDING_ACCEPTANCE` to `CONFIRMED` must be atomic in a database transaction to prevent duplicate events or race conditions.
- Maintain test coverage across all new services, guards, and controllers.

---

### Task 1: Prisma Schema & Database Migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Test: Prisma client compilation & migration replay

**Interfaces:**

- Updates `MatchStatus` enum: adds `PENDING_ACCEPTANCE`, `CONFIRMED`, `DECLINED`, `CANCELLED`.
- Creates `SlotAcceptStatus` enum: `PENDING`, `ACCEPTED`, `DECLINED`, `TIMED_OUT`.
- Creates `PenaltyReason` enum: `DODGE`, `AFK_TIMEOUT`, `MANUAL_LOCKOUT`.
- Adds `acceptStatus`, `respondedAt`, `acceptedPlayerIds` to `MatchSlot`.
- Adds `enableReadyCheck`, `readyCheckTimeoutSeconds` to `GameMode`.
- Adds `enableDodgePenalty`, `penaltyTiers`, `penaltyDecayHours` to `Project`.
- Creates `PlayerPenalty` model.

- [ ] **Step 1: Update schema.prisma with new enums and fields**
- [ ] **Step 2: Generate and apply migration**
      Run: `pnpm --dir apps/api prisma:migrate:dev --name phase_15_ready_check_penalties`
- [ ] **Step 3: Generate Prisma Client**
      Run: `pnpm --dir apps/api prisma:generate`
- [ ] **Step 4: Verify migration status**
      Run: `pnpm --dir apps/api prisma:migrate:status`

---

### Task 2: Project & GameMode DTOs and Service Updates

**Files:**

- Modify: `apps/api/src/game-modes/dto/create-game-mode.dto.ts`
- Modify: `apps/api/src/game-modes/dto/update-game-mode.dto.ts`
- Modify: `apps/api/src/projects/dto/update-project.dto.ts`
- Modify: `apps/api/src/game-modes/game-modes.service.ts`
- Modify: `apps/api/src/projects/projects.service.ts`
- Test: `apps/api/src/game-modes/game-modes.service.spec.ts`
- Test: `apps/api/src/projects/projects.service.spec.ts`

- [ ] **Step 1: Write failing unit test for GameMode ready check settings**
      Add unit test verifying `create` and `update` persist `enableReadyCheck` and `readyCheckTimeoutSeconds`.
- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm --dir apps/api test -- game-modes.service.spec.ts`
- [ ] **Step 3: Update GameMode DTOs and service implementation**
- [ ] **Step 4: Write failing unit test for Project penalty configuration**
      Add unit test verifying `update` persists `enableDodgePenalty`, `penaltyTiers`, `penaltyDecayHours`.
- [ ] **Step 5: Update Project DTOs and service implementation**
- [ ] **Step 6: Run tests to verify all pass**
      Run: `pnpm --dir apps/api test -- game-modes.service.spec.ts projects.service.spec.ts`

---

### Task 3: BullMQ Ready Check Timeout Queue Setup

**Files:**

- Create: `apps/api/src/matches/ready-check-timeout.processor.ts`
- Modify: `apps/api/src/matches/matches.module.ts`
- Modify: `apps/api/src/worker-app.module.ts`
- Test: `apps/api/src/matches/ready-check-timeout.processor.spec.ts`

- [ ] **Step 1: Register queue `ready-check-timeout` in `MatchesModule`**
- [ ] **Step 2: Write failing unit test for `ReadyCheckTimeoutProcessor`**
      Test verifying that when timeout job executes on a `PENDING_ACCEPTANCE` match, it transitions match to `CANCELLED`, marks slots as `TIMED_OUT`, and calls penalty/requeue hooks.
- [ ] **Step 3: Implement `ReadyCheckTimeoutProcessor`**
- [ ] **Step 4: Register `ReadyCheckTimeoutProcessor` in `MatchesModule` and `WorkerAppModule`**
- [ ] **Step 5: Run tests to verify it passes**
      Run: `pnpm --dir apps/api test -- ready-check-timeout.processor.spec.ts`

---

### Task 4: Match Formation Ready Check Integration in QueuesService

**Files:**

- Modify: `apps/api/src/queues/queues.service.ts`
- Modify: `apps/api/src/queues/queues.module.ts`
- Test: `apps/api/src/queues/queues.service.spec.ts`

- [ ] **Step 1: Write failing unit tests for `tryCreateMatch` conditional status assignment**
    - When `gameMode.enableReadyCheck == true`: match status is `PENDING_ACCEPTANCE`, schedules BullMQ timeout job on `ready-check-timeout`, emits `match.ready_check_started`.
    - When `gameMode.enableReadyCheck == false`: match status is `CREATED`, immediate `match.created` delivery.
- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm --dir apps/api test -- queues.service.spec.ts`
- [ ] **Step 3: Implement conditional ready check match creation & BullMQ timeout dispatch in `QueuesService.tryCreateMatch`**
- [ ] **Step 4: Run test to verify it passes**
      Run: `pnpm --dir apps/api test -- queues.service.spec.ts`

---

### Task 5: Matches Ready Check API Endpoints

**Files:**

- Modify: `apps/api/src/matches/matches.service.ts`
- Modify: `apps/api/src/matches/matches.controller.ts`
- Create: `apps/api/src/matches/dto/accept-match.dto.ts`
- Create: `apps/api/src/matches/dto/decline-match.dto.ts`
- Create: `apps/api/src/matches/dto/ready-check-status.dto.ts`
- Test: `apps/api/src/matches/matches.service.spec.ts`
- Test: `apps/api/src/matches/matches.controller.spec.ts`

- [ ] **Step 1: Write failing tests for `acceptMatch`, `declineMatch`, `getReadyCheckStatus`**
    - `acceptMatch`: updates slot `acceptedPlayerIds`. When all members in slot accepted, sets slot `acceptStatus = ACCEPTED`. If last slot, atomic transaction sets match to `CONFIRMED` and cancels BullMQ timeout.
    - `declineMatch`: sets slot to `DECLINED`, match to `DECLINED`, triggers penalty & priority re-queue.
    - `getReadyCheckStatus`: calculates countdown seconds remaining and accepted player list.
- [ ] **Step 2: Run tests to verify they fail**
      Run: `pnpm --dir apps/api test -- matches.service.spec.ts`
- [ ] **Step 3: Implement DTOs, service logic with atomic transactions, and controller endpoints**
- [ ] **Step 4: Run tests to verify they pass**
      Run: `pnpm --dir apps/api test -- matches.service.spec.ts matches.controller.spec.ts`

---

### Task 6: Priority Re-Queue Engine

**Files:**

- Modify: `apps/api/src/queues/queues.service.ts`
- Modify: `apps/api/src/matches/matches.service.ts`
- Test: `apps/api/src/queues/queues.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `requeueInnocentEntries`**
    - Verifies that innocent `QueueEntry` records have status reverted from `MATCHED` to `QUEUED`.
    - Verifies original `queuedAt` timestamp is strictly preserved.
    - Verifies immediate `matchmaking-pool` sweep job is triggered.
- [ ] **Step 2: Implement `requeueInnocentEntries` in `QueuesService`**
- [ ] **Step 3: Run test to verify it passes**
      Run: `pnpm --dir apps/api test -- queues.service.spec.ts`

---

### Task 7: Player Penalties Service & Escalation Algorithm

**Files:**

- Create: `apps/api/src/penalties/penalties.service.ts`
- Create: `apps/api/src/penalties/penalties.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/worker-app.module.ts`
- Test: `apps/api/src/penalties/penalties.service.spec.ts`

- [ ] **Step 1: Write failing unit tests for penalty creation and tier escalation**
    - First offense: applies `penaltyTiers[0]` (e.g. 180s).
    - Second offense within `penaltyDecayHours`: applies `penaltyTiers[1]` (e.g. 900s).
    - Offense after decay window: resets to `penaltyTiers[0]`.
    - Manual lockout support with custom duration.
    - Pardon / Revoke action sets `revokedAt` and `revokedByUserId`.
- [ ] **Step 2: Implement `PenaltiesService`**
- [ ] **Step 3: Run test to verify it passes**
      Run: `pnpm --dir apps/api test -- penalties.service.spec.ts`

---

### Task 8: Enqueue Guard Penalty Blocking

**Files:**

- Modify: `apps/api/src/queues/queues.service.ts`
- Modify: `apps/api/src/queues/queues.module.ts`
- Test: `apps/api/src/queues/queues.service.spec.ts`

- [ ] **Step 1: Write failing unit test for `QueuesService.enqueue` with penalized player**
    - If any player in `members` array has an active non-revoked penalty (`expiresAt > now()`), throw `ForbiddenException` (`PLAYER_IN_COOLDOWN`).
- [ ] **Step 2: Run test to verify it fails**
      Run: `pnpm --dir apps/api test -- queues.service.spec.ts`
- [ ] **Step 3: Integrate penalty check in `QueuesService.enqueue`**
- [ ] **Step 4: Run test to verify it passes**
      Run: `pnpm --dir apps/api test -- queues.service.spec.ts`

---

### Task 9: Operator Penalties Controller & REST API

**Files:**

- Create: `apps/api/src/penalties/penalties.controller.ts`
- Create: `apps/api/src/penalties/dto/create-manual-penalty.dto.ts`
- Create: `apps/api/src/penalties/dto/query-penalties.dto.ts`
- Test: `apps/api/src/penalties/penalties.controller.spec.ts`

- [ ] **Step 1: Write failing controller unit tests for list, create manual lockout, and pardon**
- [ ] **Step 2: Implement controller endpoints and Swagger OpenAPI annotations**
- [ ] **Step 3: Run tests to verify they pass**
      Run: `pnpm --dir apps/api test -- penalties.controller.spec.ts`

---

### Task 10: Webhook Delivery Integration

**Files:**

- Modify: `apps/api/src/deliveries/deliveries.service.ts`
- Modify: `apps/api/src/matches/matches.service.ts`
- Modify: `apps/api/src/penalties/penalties.service.ts`
- Test: `apps/api/src/deliveries/deliveries.service.spec.ts`

- [ ] **Step 1: Support new webhook event types:**
    - `match.ready_check_started`
    - `match.accepted`
    - `match.confirmed`
    - `match.declined`
    - `match.ready_check_expired`
    - `player.penalized`
- [ ] **Step 2: Write tests verifying payload schemas and event dispatches**
- [ ] **Step 3: Implement event triggers across `MatchesService` and `PenaltiesService`**
- [ ] **Step 4: Run tests to verify they pass**

---

### Task 11: Dashboard UI — GameMode & Project Settings

**Files:**

- Modify: `apps/web/app/dashboard/projects/[projectId]/page.tsx`
- Modify: `apps/web/components/game-modes-table.tsx` (or GameMode modal)
- Create: `apps/web/components/penalty-settings-card.tsx`
- Modify: `apps/web/lib/actions.ts`
- Modify: `apps/web/lib/api.ts`
- Test: Typecheck & lint validation

- [ ] **Step 1: Add Ready Check toggle & timeout input to GameMode form/modal**
- [ ] **Step 2: Add Penalty policy card to Project details/settings page**
- [ ] **Step 3: Run web typecheck**
      Run: `pnpm --dir apps/web typecheck`

---

### Task 12: Dashboard UI — Match Inspector & Penalties Moderation Page

**Files:**

- Modify: `apps/web/app/dashboard/projects/[projectId]/matches/page.tsx`
- Create: `apps/web/app/dashboard/projects/[projectId]/penalties/page.tsx`
- Create: `apps/web/app/dashboard/projects/[projectId]/penalties/loading.tsx`
- Create: `apps/web/app/dashboard/projects/[projectId]/penalties/error.tsx`
- Create: `apps/web/components/penalties-table.tsx`
- Create: `apps/web/components/pardon-penalty-modal.tsx`
- Create: `apps/web/components/manual-penalty-modal.tsx`
- Modify: `apps/web/components/project-nav.tsx` (Add "Penalties" navigation link)
- Test: Typecheck & lint validation

- [ ] **Step 1: Update Matches table / detail with Ready Check countdown & slot status badges**
- [ ] **Step 2: Create Penalties management page with search, filters, and action modals**
- [ ] **Step 3: Add Penalties item to project navigation in `project-nav.tsx`**
- [ ] **Step 4: Run web typecheck and build**
      Run: `pnpm --dir apps/web typecheck && pnpm --dir apps/web build`

---

### Task 13: End-to-End Tests & Final Verification

**Files:**

- Create: `apps/api/test/ready-check.e2e-spec.ts`
- Create: `apps/api/test/player-penalties.e2e-spec.ts`
- Test: Full test suite execution

- [ ] **Step 1: Implement full E2E test for Ready Check happy path (All Accept -> Confirmed)**
- [ ] **Step 2: Implement full E2E test for Decline flow (Decline -> Penalty -> Priority Re-queue -> Enqueue blocked)**
- [ ] **Step 3: Run all API and e2e tests**
      Run: `pnpm api:test && pnpm api:test:e2e`
- [ ] **Step 4: Regenerate OpenAPI specification**
      Run: `pnpm --dir apps/api openapi:generate`
- [ ] **Step 5: Run full workspace lint and format**
      Run: `pnpm lint && pnpm format`
