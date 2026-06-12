# API Spec v1

## Conventions

- Base path: `/v1`
- Authentication for game servers: `Authorization: Bearer <project_api_key>`
- Authentication for dashboard users: `Authorization: Bearer <dashboard_admin_token>`
- All write endpoints should support `idempotency_key`
- Timestamps use ISO 8601 UTC

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

Creates a new project.

Current implementation note:

- until dashboard auth exists, project creation bootstraps the first owner and organization in the same request

Request:

```json
{
  "name": "Arena VN",
  "slug": "arena-vn",
  "defaultRegion": "ap-southeast-1",
  "owner": {
    "email": "owner@example.com",
    "name": "Arena Owner"
  },
  "organization": {
    "name": "Arena Studio",
    "slug": "arena-studio"
  },
  "environments": [
    "development",
    "production"
  ]
}
```

Response:

```json
{
  "id": "proj_123",
  "name": "Arena VN",
  "slug": "arena-vn",
  "defaultRegion": "ap-southeast-1",
  "createdAt": "2026-06-12T00:00:00Z"
}
```

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
  "events": [
    "match.created",
    "match.failed",
    "queue.timeout",
    "match.completed",
    "rating.updated"
  ]
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

### `GET /v1/projects/:projectId/pools`

Returns active pools and waiting counts.

### `GET /v1/projects/:projectId/matches`

Returns match history with filters for mode, status, and time range.

### `GET /v1/projects/:projectId/rating-history`

Returns rating history when `internal_elo` is enabled.

### `GET /v1/projects/:projectId/webhook-deliveries`

Returns webhook delivery attempts and statuses.

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
