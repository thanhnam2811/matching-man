# Phase 15: Match Ready Check Handshake, Priority Re-queue, and Player Dodge Penalties — Design

## Status

- [x] Approved / Planned

## Objective

Elevate match quality and player experience by:

1. Introducing an interactive **Ready Check (Accept/Decline Handshake)** into the match lifecycle with zero breaking changes for existing un-checked game modes.
2. Automating asynchronous timeout handling via **BullMQ** for unresponsive or AFK matches (`PENDING_ACCEPTANCE`).
3. Implementing an automated **Priority Re-queue** mechanism for innocent players who accepted matches aborted by others.
4. Implementing a studio-configurable **Player Penalty & Queue Lockout** system with progressive tiers and decay windows to disincentivize queue dodging and AFK behavior.
5. Providing full **Operator Dashboard Tooling** in `apps/web` for moderation (view lockouts, search player, pardon/revoke, and manual lockout) and game mode/project configuration.

Graduated from `docs/roadmap/backlog.md` ("Accept or decline handshake", "Player Cooldowns & Queue Priority").

---

## 1. Architecture & State Machine

### 1.1 Match Lifecycle State Diagram

```
[ Enqueue Players ]
       │
       ▼
[ Match Found in Pool ]
       │
       ├──────────────────────────────────────────────┐
       │ (GameMode.enableReadyCheck == false)         │ (GameMode.enableReadyCheck == true)
       ▼                                              ▼
[ Match CREATED / IN_PROGRESS ]             [ Match PENDING_ACCEPTANCE ]
                                                      │
                                                      │ (BullMQ Job: match-ready-check-timeout scheduled)
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

### 1.2 State Machine Transitions

| Current Status       | Event / Trigger                           | Next Status                                          | Actions                                                                                                                   |
| :------------------- | :---------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `QUEUED`             | Match found (Ready check enabled)         | `MATCHED` (QueueEntry), `PENDING_ACCEPTANCE` (Match) | Schedule BullMQ timeout job, emit `match.ready_check_started`.                                                            |
| `QUEUED`             | Match found (Ready check disabled)        | `MATCHED` (QueueEntry), `CREATED` (Match)            | Immediate webhook delivery `match.created` (Legacy flow).                                                                 |
| `PENDING_ACCEPTANCE` | Player calls `POST /accept` (not last)    | `PENDING_ACCEPTANCE`                                 | Record slot accept status & timestamp, emit `match.accepted`.                                                             |
| `PENDING_ACCEPTANCE` | Player calls `POST /accept` (last player) | `CONFIRMED`                                          | Cancel BullMQ timeout job, emit `match.confirmed`.                                                                        |
| `PENDING_ACCEPTANCE` | Player calls `POST /decline`              | `DECLINED`                                           | Cancel match, revert innocent queue entries to `QUEUED`, penalize decliner, emit `match.declined`.                        |
| `PENDING_ACCEPTANCE` | BullMQ timeout fires (AFK)                | `CANCELLED`                                          | Cancel match, revert innocent queue entries to `QUEUED`, penalize unresponsive players, emit `match.ready_check_expired`. |

---

## 2. Data Model & Prisma Schema

### 2.1 Enums & Schema Updates (`apps/api/prisma/schema.prisma`)

```prisma
enum MatchStatus {
  CREATED
  PENDING_ACCEPTANCE
  CONFIRMED
  DECLINED
  CANCELLED
  IN_PROGRESS
  COMPLETED
  FAILED
  EXPIRED
  DISPUTED
}

enum SlotAcceptStatus {
  PENDING
  ACCEPTED
  DECLINED
  TIMED_OUT
}

enum PenaltyReason {
  DODGE
  AFK_TIMEOUT
  MANUAL_LOCKOUT
}

model MatchSlot {
  id                 String           @id @default(cuid())
  matchId            String           @map("match_id")
  queueEntryId       String           @map("queue_entry_id")
  teamId             String           @map("team_id")
  slotIndex          Int              @map("slot_index")
  groupIndex         Int              @map("group_index")
  teamSnapshot       Json             @map("team_snapshot")
  acceptStatus       SlotAcceptStatus @default(PENDING) @map("accept_status")
  respondedAt        DateTime?        @map("responded_at")
  acceptedPlayerIds  Json             @default("[]") @map("accepted_player_ids")
  createdAt          DateTime         @default(now()) @map("created_at")

  match              Match            @relation(fields: [matchId], references: [id])
  queueEntry         QueueEntry       @relation(fields: [queueEntryId], references: [id])
  team               Team             @relation(fields: [teamId], references: [id])

  @@unique([matchId, slotIndex])
  @@unique([queueEntryId])
  @@index([teamId])
  @@map("match_slots")
}

model GameMode {
  // ... existing fields
  enableReadyCheck            Boolean  @default(false) @map("enable_ready_check")
  readyCheckTimeoutSeconds    Int      @default(20) @map("ready_check_timeout_seconds")
  // ...
}

model Project {
  // ... existing fields
  enableDodgePenalty          Boolean  @default(true) @map("enable_dodge_penalty")
  penaltyTiers                Json     @default("[180, 900, 3600, 86400]") @map("penalty_tiers")
  penaltyDecayHours           Int      @default(24) @map("penalty_decay_hours")
  // ...
  penalties                   PlayerPenalty[]
}

model PlayerPenalty {
  id              String        @id @default(cuid())
  projectId       String        @map("project_id")
  playerId        String        @map("player_id")
  reason          PenaltyReason @default(DODGE)
  durationSeconds Int           @map("duration_seconds")
  expiresAt       DateTime      @map("expires_at")
  violationCount  Int           @default(1) @map("violation_count")
  revokedAt       DateTime?     @map("revoked_at")
  revokedByUserId String?       @map("revoked_by_user_id")
  revocationNotes String?       @map("revocation_notes")
  metadata        Json?
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  revokedByUser   User?         @relation("RevokedPenalties", fields: [revokedByUserId], references: [id], onDelete: SetNull)

  @@index([projectId, playerId, expiresAt])
  @@index([projectId, createdAt])
  @@map("player_penalties")
}
```

---

## 3. Public API & Control Plane Contracts

### 3.1 Match Ready Check Handshake API (`apps/api/src/matches`)

#### `POST /v1/matches/:id/accept`

- **Auth:** Project `ApiKey` (Bearer token)
- **Request Body:**
    ```json
    {
        "playerId": "player-123",
        "teamId": "team-456"
    }
    ```
- **Responses:**
    - `200 OK`:
        ```json
        {
            "matchId": "cm012345...",
            "status": "PENDING_ACCEPTANCE",
            "acceptedCount": 7,
            "requiredCount": 10,
            "isComplete": false
        }
        ```
    - `200 OK` (when last player accepts):
        ```json
        {
            "matchId": "cm012345...",
            "status": "CONFIRMED",
            "acceptedCount": 10,
            "requiredCount": 10,
            "isComplete": true
        }
        ```
    - `400 Bad Request`: Match not in `PENDING_ACCEPTANCE` or already expired.
    - `404 Not Found`: Match or player/team not part of this match.

#### `POST /v1/matches/:id/decline`

- **Auth:** Project `ApiKey`
- **Request Body:**
    ```json
    {
        "playerId": "player-123",
        "teamId": "team-456",
        "reason": "User clicked cancel"
    }
    ```
- **Responses:**
    - `200 OK`:
        ```json
        {
            "matchId": "cm012345...",
            "status": "DECLINED",
            "declinedByPlayerId": "player-123",
            "penaltyApplied": true,
            "cooldownExpiresAt": "2026-08-25T17:30:00.000Z"
        }
        ```

#### `GET /v1/matches/:id/ready-check`

- **Auth:** Project `ApiKey`
- **Response:**
    ```json
    {
        "matchId": "cm012345...",
        "status": "PENDING_ACCEPTANCE",
        "timeoutSeconds": 20,
        "expiresAt": "2026-08-25T17:15:20.000Z",
        "remainingSeconds": 14,
        "totalPlayers": 10,
        "acceptedPlayerIds": ["player-1", "player-2", "player-3"],
        "slots": [
            {
                "slotIndex": 0,
                "teamId": "team-1",
                "acceptStatus": "ACCEPTED",
                "respondedAt": "2026-08-25T17:15:08.000Z"
            }
        ]
    }
    ```

---

### 3.2 Enqueue Guard & Penalty Enforcement (`apps/api/src/queues`)

#### `POST /v1/queue/enqueue`

- **Behavior:** Before creating `QueueEntry`, inspect active penalties (`expiresAt > now() && revokedAt IS NULL`) for all `members[].playerId`.
- **Response if blocked (`403 Forbidden`):**
    ```json
    {
        "statusCode": 403,
        "error": "PLAYER_IN_COOLDOWN",
        "message": "Player 'player-123' is locked out from queueing until 2026-08-25T17:30:00.000Z.",
        "playerId": "player-123",
        "expiresAt": "2026-08-25T17:30:00.000Z",
        "reason": "DODGE",
        "violationCount": 2
    }
    ```

---

### 3.3 Operator Moderation API (`apps/api/src/penalties`)

- `GET /v1/projects/:id/penalties` — Paginated list of penalties (filter by status: `ACTIVE`, `EXPIRED`, `REVOKED`, search by `playerId`).
- `POST /v1/projects/:id/penalties` — Manual lockout creation (`playerId`, `durationSeconds`, `reason`, `notes`).
- `DELETE /v1/projects/:id/penalties/:penaltyId` — Pardon / Revoke active penalty (`revocationNotes`).

---

## 4. BullMQ Queues & Worker Architecture

| Queue Name            | Job Name              | Producer                       | Consumer                     | Purpose                                                                           |
| :-------------------- | :-------------------- | :----------------------------- | :--------------------------- | :-------------------------------------------------------------------------------- |
| `ready-check-timeout` | `check-ready-timeout` | `QueuesService.tryCreateMatch` | `ReadyCheckTimeoutProcessor` | Delayed job scheduled for `now + timeoutSeconds`. Cancels match if still pending. |
| `matchmaking-pool`    | `sweep-pool`          | Priority Re-queue Engine       | `MatchMakerSweepProcessor`   | Prioritized sweep triggered immediately when innocent players are re-queued.      |

---

## 5. Webhook Event Catalog (`apps/api/src/deliveries`)

1. `match.ready_check_started`: Match formed in `PENDING_ACCEPTANCE`, countdown begins.
2. `match.accepted`: Player/team accepted, returns current progress.
3. `match.confirmed`: 100% accepted, match confirmed.
4. `match.declined`: Match declined by a participant, includes offending player.
5. `match.ready_check_expired`: Match timed out due to AFK.
6. `player.penalized`: Penalty issued with duration and expiration.
