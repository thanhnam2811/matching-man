# API Spec v1

## Interactive Docs

- Swagger UI: `GET /v1/docs` (run the API locally, e.g. `pnpm start:dev`, then open `http://localhost:3000/v1/docs`)
- Raw OpenAPI document: [openapi.json](./openapi.json), regenerated with `pnpm --dir apps/api openapi:generate`
- The generator only needs `DATABASE_URL`, `DASHBOARD_ADMIN_TOKEN`, and `SESSION_SECRET` to be set (any value works — it inspects route metadata and never opens a DB connection)

## Conventions

- Base path: `/v1`
- Authentication for game servers: `Authorization: Bearer <project_api_key>` (Swagger security scheme `projectApiKey`) — used by the queues, matches, deliveries, and ratings endpoints
- Authentication for dashboard users: `Authorization: Bearer <session_token>` (from register/login) or `Authorization: Bearer <dashboard_admin_token>` (break-glass super-admin) — both map to the Swagger security scheme `sessionToken`
- Dashboard routes are tenant-scoped: a user only sees organizations and projects they are a member of; the admin token sees everything
- All write endpoints should support `idempotency_key`
- Timestamps use ISO 8601 UTC

## Dashboard Auth

### `POST /v1/auth/register`

Creates a user, seeds a personal organization (caller becomes `OWNER`), and returns a session token.

Request: `{ "email": "owner@example.com", "password": "********", "name": "Owner", "organizationName": "Acme" }`
Response: `{ "token": "<session_token>", "expiresAt": "...", "user": { "id": "...", "email": "...", "name": "..." } }`

### `POST /v1/auth/login`

Verifies the password and returns a session token (same shape as register).

### `GET /v1/auth/me`

Requires a session token. Returns the current user and their organization memberships with roles.

### Organization membership

- `GET /v1/organizations/:organizationId/members`
- `POST /v1/organizations/:organizationId/members` — `{ "email", "role" }`; the invitee must already be registered
- `PATCH /v1/organizations/:organizationId/members/:memberId` — `{ "role" }`
- `DELETE /v1/organizations/:organizationId/members/:memberId`

Managing members requires `ADMIN` or `OWNER`; an organization must keep at least one `OWNER`.

## Implementation Notes

- Public API implementation target: `NestJS`
- DTO validation should be enforced at the controller boundary
- API keys must always be scoped to one project
- Background effects such as webhooks or timeout handling may be asynchronous even when the main write request succeeds synchronously

## Rating Modes

Allowed values:

- `internal_elo`
- `external_rating`
- `disabled`

## Main Resources

- projects
- webhooks
- queue entries
- matches
- ratings

## Project Management

### `POST /v1/projects`

Creates a project inside an organization the caller belongs to. The caller is added as the project `OWNER`. Requires a session token (or admin token).

Request:

```json
{
    "name": "Arena VN",
    "slug": "arena-vn",
    "organizationId": "org_123",
    "defaultRegion": "ap-southeast-1",
    "environments": ["development", "production"]
}
```

Response:

```json
{
    "id": "proj_123",
    "name": "Arena VN",
    "slug": "arena-vn",
    "defaultRegion": "ap-southeast-1",
    "organization": { "id": "org_123", "name": "Arena Studio", "slug": "arena-studio" },
    "environments": [{ "id": "env_1", "name": "development", "isDefault": true }],
    "createdAt": "2026-06-12T00:00:00Z"
}
```

### `POST /v1/organizations`

Creates a tenant owned by the caller. Request: `{ "name": "Arena Studio", "slug": "arena-studio" }` (`slug` optional, derived from name). `GET /v1/organizations` returns only the caller's organizations.

### `POST /v1/projects/:projectId/api-keys`

Creates a project API key.

Additional implemented endpoints:

- `GET /v1/projects`
- `GET /v1/projects/:projectId`
- `GET /v1/projects/:projectId/members`
- `POST /v1/projects/:projectId/members`
- `PATCH /v1/projects/:projectId/members/:memberId`
- `DELETE /v1/projects/:projectId/members/:memberId`
- `GET /v1/projects/:projectId/environments`
- `POST /v1/projects/:projectId/environments`
- `PATCH /v1/projects/:projectId/environments/:environmentId`
- `DELETE /v1/projects/:projectId/environments/:environmentId`
- `GET /v1/projects/:projectId/api-keys`
- `POST /v1/projects/:projectId/api-keys/:apiKeyId/revoke`

### `POST /v1/organizations`

Creates a new organization for later project attachment.

Additional implemented endpoints:

- `GET /v1/organizations`
- `GET /v1/organizations/:organizationId`

### `POST /v1/projects/:projectId/webhooks`

Registers a webhook endpoint.

Request:

```json
{
    "url": "https://game.example.com/match-callback",
    "events": ["match.created", "match.failed", "queue.timeout", "match.completed", "rating.updated"]
}
```

Additional implemented endpoints:

- `GET /v1/projects/:projectId/webhooks`
- `PATCH /v1/projects/:projectId/webhooks/:webhookId`
- `DELETE /v1/projects/:projectId/webhooks/:webhookId`

Read responses do not expose the raw webhook signing secret after creation.

## Queue APIs

### `POST /v1/queues/enqueue`

Adds a team or solo player to a matchmaking pool.

Request:

```json
{
    "idempotency_key": "enq_001",
    "projectId": "proj_123",
    "environment": "production",
    "gameModeId": "mode_ranked_5v5",
    "team": {
        "externalTeamId": "team_1001",
        "members": [
            {
                "playerId": "p1",
                "rating": 1510
            },
            {
                "playerId": "p2",
                "rating": 1490
            }
        ]
    },
    "rating_mode": "external_rating",
    "region": "ap-southeast-1",
    "metadata": {
        "party_size": 2
    }
}
```

Response:

```json
{
    "queueEntryId": "qe_123",
    "status": "queued",
    "poolKey": "proj_123:production:mode_ranked_5v5:ap-southeast-1",
    "queuedAt": "2026-06-12T00:00:00Z"
}
```

### `POST /v1/queues/dequeue`

Removes a waiting entry from the queue.

Request:

```json
{
    "idempotency_key": "deq_001",
    "queueEntryId": "qe_123",
    "reason": "party_cancelled"
}
```

Response:

```json
{
    "queueEntryId": "qe_123",
    "status": "cancelled"
}
```

## Match APIs

### `GET /v1/matches/:matchId`

Returns the current match state.

Response:

```json
{
    "id": "match_123",
    "projectId": "proj_123",
    "gameModeId": "mode_ranked_5v5",
    "status": "created",
    "slots": [
        {
            "slotIndex": 1,
            "groupIndex": 1,
            "teamId": "team_1001"
        },
        {
            "slotIndex": 2,
            "groupIndex": 2,
            "teamId": "team_2002"
        }
    ],
    "createdAt": "2026-06-12T00:00:10Z"
}
```

### `POST /v1/matches/:matchId/report-result`

Reports the final outcome of a match.

Request:

```json
{
    "idempotency_key": "result_001",
    "winner_side": "A",
    "ended_at": "2026-06-12T00:25:00Z",
    "metadata": {
        "duration_seconds": 1490,
        "server_match_id": "gs_abc_999"
    }
}
```

Response:

```json
{
    "match_id": "match_123",
    "status": "completed",
    "rating_update_status": "pending"
}
```

`rating_update_status` meanings:

- `pending`: follow-up processing still running
- `skipped`: rating mode does not require hub-managed updates
- `completed`: rating updates already finalized in the same request path

## Dashboard Read APIs

All dashboard read endpoints require the dashboard admin bearer token (`DashboardAdminGuard`) and are scoped by the `:projectId` path parameter.

### `GET /v1/projects/:projectId/pools`

Returns active pools and waiting counts.

### `GET /v1/projects/:projectId/matches`

Returns paginated match history. Query filters: `gameModeId`, `status`, `from`, `to` (ISO 8601, applied to `createdAt`), `limit` (1-100, default 50), `offset`. Each item includes the recorded `result` (`winnerGroupIndex`, `endedAt`) or `null` when the match has no outcome yet.

### `GET /v1/projects/:projectId/rating-history`

Returns paginated rating history when `internal_elo` is enabled. Query filters: `playerId`, `gameModeId`, `limit` (1-200, default 50), `offset`.

### `GET /v1/projects/:projectId/webhook-deliveries`

Returns paginated webhook delivery attempts and statuses. Query filters: `status`, `endpointId`, `limit` (1-100, default 50), `offset`.

## Webhook Events

All webhook payloads should include:

- event id
- event type
- project id
- occurred at
- delivery attempt number
- signed payload header

Suggested signature header:

- `X-MatchingHub-Signature`

### `match.created`

Payload:

```json
{
    "event": "match.created",
    "event_id": "evt_001",
    "project_id": "proj_123",
    "occurred_at": "2026-06-12T00:00:10Z",
    "data": {
        "match_id": "match_123",
        "game_mode_id": "mode_ranked_5v5",
        "slots": [
            {
                "slot_index": 1,
                "group_index": 1,
                "team_id": "team_1001"
            },
            {
                "slot_index": 2,
                "group_index": 2,
                "team_id": "team_2002"
            }
        ]
    }
}
```

### `match.failed`

Used when a match creation attempt fails after candidate selection or validation.

### `queue.timeout`

Used when a queue entry expires before a valid match is found.

### `match.completed`

Sent after result reporting is accepted.

### `rating.updated`

Sent only when `internal_elo` is active and rating changes are finalized.

## Status Model

### Queue Entry Status

- `queued`
- `matched`
- `cancelled`
- `timed_out`
- `failed`

### Match Status

- `created`
- `in_progress`
- `completed`
- `failed`
- `expired`
- `disputed`

## Error Shape

Suggested error format:

```json
{
    "error": {
        "code": "invalid_rating_mode",
        "message": "rating_mode must be one of internal_elo, external_rating, disabled"
    }
}
```

## Deferred for Later Versions

Not required for v1:

- accept or decline handshake
- region latency probing
- manual dispute resolution endpoints
- season reset endpoints
- bulk backfill rating recalculation
