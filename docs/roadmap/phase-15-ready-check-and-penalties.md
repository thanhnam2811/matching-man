# Phase 15: Match Ready Check Handshake & Player Dodge Penalties

## Status

- [ ] Scheduled

## Objective

Elevate match quality and player experience by introducing an interactive **Ready Check (Accept/Decline Handshake)** into the match lifecycle, an automated **Priority Re-queue** mechanism for innocent players when a match falls through, and a robust **Player Penalty & Queue Lockout** system to disincentivize queue dodging and AFK behavior.

Graduated from:

- `docs/roadmap/backlog.md`: Advanced Matchmaking (_"Accept or decline handshake"_)
- Backlog extension: Player Cooldowns, Queue Priority & Moderation

---

## Architecture & Lifecycle Overview

```
[ Enqueue Players ]
       │
       ▼
[ Match Found in Pool ]
       │
       ├──────────────────────────────────────────────┐
       │ (Ready Check Disabled)                       │ (Ready Check Enabled)
       ▼                                              ▼
[ Match CREATED / IN_PROGRESS ]             [ Match PENDING_ACCEPTANCE ]
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    ▼                                   ▼
                         [ All Slots Accepted ]             [ Decline or AFK Timeout ]
                                    │                                   │
                                    ▼                                   ├─────────────────────────────┐
                        [ Match CONFIRMED / IN_PROGRESS ]               ▼                             ▼
                                                           [ Innocent Slots Re-queued ]   [ Dodger / AFK Penalized ]
                                                             (Preserved High Priority)      (Active Cooldown / Ban)
```

---

## Finalized Architectural Decisions (from Design Tree)

1. **Granularity:** Per-Player acceptance tracking. Game Server calls `POST /v1/matches/:id/accept` passing `playerId` and `teamId`.
2. **Backward Compatibility:** Zero breaking changes. If `GameMode.enableReadyCheck == false`, existing `CREATED` -> instant webhook flow is retained. If `true`, `match.ready_check_started` is emitted, followed by `match.accepted` / `match.declined` / `match.ready_check_expired`, and `match.confirmed` once all accept.
3. **Priority Re-Queue:** In-place status revert (`QueueEntry.status = QUEUED`, retaining original `queuedAt` timestamp and `idempotencyKey`).
4. **Configuration Hierarchy (Studio-tunable):**
    - **`GameMode` Level:** `enableReadyCheck` (`Boolean`), `readyCheckTimeoutSeconds` (`Int`).
    - **`Project` Level:** `enableDodgePenalty` (`Boolean`), `penaltyTiers` (`Json` array of seconds e.g. `[180, 900, 3600, 86400]`), `penaltyDecayHours` (`Int` e.g. `24`).
5. **Party/Team Dodge Handling:** Only the offending player is penalized. Non-offending teammates in the party are removed from the queue without penalty (party disband). Opposing innocent teams are priority re-queued.
6. **Authentication & Concurrency:** Server-to-Server via Project `ApiKey`. Atomic state transition via PostgreSQL/Prisma transaction to avoid duplicate confirmations.
7. **Operator Dashboard:** Full moderation suite (List active cooldowns, search player, Pardon/Revoke button, and Manual Lockout modal).

---

## Stages

### Stage 1 — Prisma Schema & State Machine Extensions

Extend data models to support acceptance tracking, player moderation, and backward-compatible project/game mode configuration.

- [ ] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - **`MatchStatus` Enum:** Add `PENDING_ACCEPTANCE`, `CONFIRMED`, `DECLINED`, `CANCELLED` (while preserving existing `CREATED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `EXPIRED`, `DISPUTED`).
    - **`SlotAcceptStatus` Enum:** `PENDING`, `ACCEPTED`, `DECLINED`, `TIMED_OUT`.
    - **`MatchSlot` Updates:** Add fields:
        - `acceptStatus`: `SlotAcceptStatus` (default `PENDING`).
        - `respondedAt`: `DateTime?`.
        - `acceptedPlayerIds`: `Json` (default `[]` - tracks individual player IDs who accepted).
    - **`GameMode` Updates:** Add configuration fields:
        - `enableReadyCheck`: `Boolean` (default `false`).
        - `readyCheckTimeoutSeconds`: `Int` (default `20`).
    - **`Project` Updates:** Add configuration fields:
        - `enableDodgePenalty`: `Boolean` (default `true`).
        - `penaltyTiers`: `Json` (default `[180, 900, 3600, 86400]` seconds).
        - `penaltyDecayHours`: `Int` (default `24`).
    - **New Model `PlayerPenalty`:**
        - Fields: `id`, `projectId`, `playerId`, `reason` (`DODGE`, `AFK_TIMEOUT`, `MANUAL_LOCKOUT`), `durationSeconds`, `expiresAt`, `violationCount`, `revokedAt`, `revokedByUserId`, `metadata`, `createdAt`, `updatedAt`.
        - Indexes on `[projectId, playerId, expiresAt]` and `[projectId, createdAt]`.
- [ ] Generate and apply database migration via Prisma (`pnpm --dir apps/api prisma:migrate:dev --name phase_15_ready_check_penalties`).

**Exit criteria:** Database schema fully represents ready check states, slot response status, game mode settings, and player lockout records without breaking existing match data.

---

### Stage 2 — Ready Check API & BullMQ Timeout Worker

Implement acceptance handshake endpoints and automated asynchronous timeout triggers via BullMQ.

- [ ] **Match Assembler Adaptation:**
    - If `gameMode.enableReadyCheck == true`: Set initial match status to `PENDING_ACCEPTANCE`, queue entries status to `MATCHED`, and dispatch BullMQ delayed job `match-ready-check-timeout` with delay `readyCheckTimeoutSeconds * 1000`.
    - If `gameMode.enableReadyCheck == false`: Preserve current behavior (`CREATED`, immediate match delivery).
- [ ] **Public Match Handshake Endpoints:**
    - `POST /v1/matches/:id/accept` (Accept ready check for player or team):
        - Validates match is in `PENDING_ACCEPTANCE` and not expired.
        - Sets `slot.acceptStatus = ACCEPTED`, records `slot.respondedAt`, appends `playerId` to `acceptedPlayerIds`.
        - Emits webhook `match.accepted` with progress payload (`{ acceptedCount, totalSlots }`).
        - Atomic check in Prisma Transaction: If all players/slots accepted, updates `Match.status = CONFIRMED`, cancels BullMQ timeout job, and emits `match.confirmed`.
    - `POST /v1/matches/:id/decline` (Decline ready check):
        - Sets `slot.acceptStatus = DECLINED`.
        - Transitions match to `DECLINED` / `CANCELLED`.
        - Triggers Stage 3 Priority Re-queue & Penalty logic immediately.
        - Emits webhook `match.declined`.
    - `GET /v1/matches/:id/ready-check` (Check ready check status, accepted players, and countdown remaining).
- [ ] **BullMQ Ready Check Timeout Consumer (`match-ready-check-timeout`):**
    - Checks if `Match.status == PENDING_ACCEPTANCE`.
    - If still pending: Marks all unresponsive slots as `TIMED_OUT` (AFK), cancels match, emits `match.ready_check_expired`, and invokes Priority Re-queue & Penalty engine.

**Exit criteria:** Players can accept or decline matches via API, BullMQ reliably cancels AFK matches on timeout, and all transition events emit webhooks.

---

### Stage 3 — Priority Re-Queue & Player Dodge Penalties

Protect well-behaved players with high-priority pool re-insertion and enforce progressive cooldowns on dodgers.

- [ ] **Priority Re-Queue Engine:**
    - When a match is aborted due to decline or timeout:
        - Innocent queue entries (opposing teams where all members accepted) have their `QueueEntry.status` reset back to `QUEUED` in-place (preserving their original `queuedAt` timestamp).
        - Unresponsive or offending teams are removed from queue (`QueueEntry.status = CANCELLED` / `FAILED`).
        - Immediately trigger a prioritized BullMQ `matchmaking-sweep` job for the corresponding `matchPoolId` so innocent players find a new match quickly.
- [ ] **Player Penalty & Cooldown Service:**
    - On decline or AFK timeout:
        - Look up player's previous non-revoked violations in the project within `penaltyDecayHours` (e.g. 24h).
        - Determine escalation tier from `project.penaltyTiers` array based on violation count.
        - Create a `PlayerPenalty` row for the offending `playerId`.
        - Emit webhook `player.penalized`.
- [ ] **Enqueue Guard Enforcement:**
    - In `POST /v1/queue/enqueue`, query active non-revoked penalties (`expiresAt > now()`) for all player IDs in the submitted team.
    - If penalized: Reject request with `403 Forbidden` / `422 Unprocessable Entity` containing penalty details:
        ```json
        {
            "statusCode": 403,
            "error": "PLAYER_IN_COOLDOWN",
            "message": "Player 'player-123' is locked out from queueing until 2026-08-25T17:00:00Z.",
            "playerId": "player-123",
            "expiresAt": "2026-08-25T17:00:00.000Z",
            "reason": "DODGE"
        }
        ```
- [ ] **Operator Penalty Management API:**
    - `GET /v1/projects/:id/penalties` (List active and historical penalties with pagination and player search).
    - `POST /v1/projects/:id/penalties` (Manual Lockout with custom duration and reason).
    - `DELETE /v1/projects/:id/penalties/:penaltyId` (Pardon / Revoke penalty immediately).

**Exit criteria:** Compliant players are immediately re-matched at the front of the queue, while dodgers are prevented from re-enqueuing until their cooldown expires or an operator pardons them.

---

### Stage 4 — Operator Dashboard UI & Moderation Tooling

Provide project administrators with complete visibility into Ready Check metrics and moderation controls.

- [ ] **GameMode Configuration Card:**
    - Add toggles in Dashboard Game Mode editor:
        - Switch: "Enable Ready Check Handshake".
        - Number Input: "Ready Check Timeout (seconds)".
- [ ] **Project Settings Configuration:**
    - Penalty policy settings card:
        - Switch: "Enable Dodge Penalty Lockout".
        - Array/Tag Input: "Penalty Duration Tiers (seconds, e.g. 180, 900, 3600, 86400)".
        - Number Input: "Violation Decay Window (hours, default 24)".
- [ ] **Match Inspector Updates:**
    - Display "Ready Check" phase badge and live countdown timer for `PENDING_ACCEPTANCE` matches.
    - Per-slot acceptance indicator: visually distinguish `Accepted` (green), `Pending` (yellow), `Declined` (red), or `AFK Timeout` (gray).
- [ ] **Player Moderation & Penalties Dashboard View:**
    - New sidebar navigation item under Project: **Penalties & Moderation**.
    - Searchable list of active cooldowns with player ID, violation reason, violation count, and time remaining.
    - Action buttons: "Pardon / Revoke Cooldown" and "Manual Lockout".

**Exit criteria:** Operators can configure ready check rules, inspect acceptance states in real time, and manage player bans/penalties directly in `apps/web`.

---

## Deliverables & Testing

1. **Unit & Integration Tests:**
    - Ready Check state transitions (accept all -> `CONFIRMED`, single decline -> `DECLINED`, timeout -> `CANCELLED`).
    - Priority Re-queue: verify `queuedAt` timestamp preservation and pool position.
    - Penalty calculation and escalation algorithm according to `project.penaltyTiers`.
    - Enqueue guard blocking active penalties and allowing expired/revoked penalties.
2. **E2E Tests:**
    - Enqueue 2 players -> Ready Check triggered -> Both Accept -> Match Confirmed.
    - Enqueue 2 players -> Player A accepts, Player B declines -> Player A re-queued at top -> Player B receives penalty -> Player B cannot enqueue until cooldown expires.
3. **Documentation Updates:**
    - Update `docs/api-spec-v1.md` with `/v1/matches/:id/accept`, `/v1/matches/:id/decline`, `/v1/projects/:id/penalties`.
    - Update `docs/architecture.md` with the new match lifecycle diagram.
