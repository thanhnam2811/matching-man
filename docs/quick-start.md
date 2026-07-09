# Quick Start: Integrate a Game Server in 10 Minutes

This walks a game server integrator through the full loop — register, create a project,
enqueue players, and receive a signed webhook when a match is found — using nothing but
`curl` and Swagger UI.

Everything here is verified against the actual DTOs and controllers in `apps/api/src`; for
the complete field list of any endpoint, use Swagger UI (`GET /v1/docs`) or
[`docs/api-spec-v1.md`](./api-spec-v1.md).

## 0. Start the stack (2 min)

```bash
pnpm install
pnpm docker:up
cp apps/api/.env.example apps/api/.env
pnpm --dir apps/api prisma:migrate:dev
pnpm --dir apps/api start:dev   # http://localhost:3000/v1
```

Fastest way to see the system working: `pnpm api:seed:demo` idempotently creates a "Demo
Arena" project with a skill-based and a casual 1v1 game mode, mints an API key, and queues
a few players (most match immediately; one is left waiting to show the rating window
expanding). It prints a `DEMO_*` env block — paste that into `apps/web/.env` and
`pnpm --dir apps/web dev` to drive the public `/demo` page against it. To integrate your
own game server instead, keep reading — the walkthrough below builds a project from
scratch with plain `curl`.

## 1. Register and get a session token (1 min)

```bash
curl -s -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.test","password":"correct-horse-battery-staple","organizationName":"Acme Games"}'
```

Registering auto-creates a personal organization with you as `OWNER`. Save the returned
`token` — every dashboard call below sends it as `Authorization: Bearer <token>`.

```bash
TOKEN="<paste token here>"
```

Fetch your organization id:

```bash
curl -s http://localhost:3000/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

## 2. Create a project (1 min)

```bash
curl -s -X POST http://localhost:3000/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Arena","slug":"arena","organizationId":"<org id from step 1>","environments":["production"]}'
```

Save the returned `id` as `PROJECT_ID`.

## 3. Create a game mode (1 min)

A `VERSUS` mode with two solo-player groups (a 1v1):

```bash
curl -s -X POST http://localhost:3000/v1/projects/$PROJECT_ID/game-modes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"key":"ranked-1v1","name":"Ranked 1v1","matchStructure":"VERSUS","requiredSlots":2,"groupCount":2,"teamSizeMin":1,"teamSizeMax":1,"ratingMode":"DISABLED"}'
```

Save the returned `id` as `GAME_MODE_ID`.

## 4. Create a project API key (30 sec)

This is what your game server uses — not the session token from step 1.

```bash
curl -s -X POST http://localhost:3000/v1/projects/$PROJECT_ID/api-keys \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Game server"}'
```

The `key` field is only ever returned once — save it as `API_KEY`.

## 5. Register a webhook endpoint to receive match events (1 min)

Point it at any URL that can receive a POST (e.g. `https://webhook.site` for testing):

```bash
curl -s -X POST http://localhost:3000/v1/projects/$PROJECT_ID/webhooks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/your-id","events":["match.created","match.completed"]}'
```

Save the returned `secret` (starts with `whsec_`) — you'll need it to verify signatures.

## 6. Enqueue two players (1 min)

Using the **project API key** from step 4, not the session token:

```bash
curl -s -X POST http://localhost:3000/v1/queues/enqueue \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"gameModeId\":\"$GAME_MODE_ID\",\"environment\":\"production\",\"team\":{\"members\":[{\"playerId\":\"alice\"}]}}"

curl -s -X POST http://localhost:3000/v1/queues/enqueue \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"gameModeId\":\"$GAME_MODE_ID\",\"environment\":\"production\",\"team\":{\"members\":[{\"playerId\":\"bob\"}]}}"
```

The second call matches immediately (a 1v1 needs exactly two solo teams) and returns a
non-null `matchId` in the response. Your webhook endpoint receives a `match.created`
POST within seconds — headers `X-Webhook-Event`, `X-Webhook-Timestamp`, and
`X-Webhook-Signature: sha256=<hmac>` (HMAC-SHA256 of `"<timestamp>.<raw body>"`, keyed by
the hex-decoded webhook secret from step 5).

## 7. Report the match result (1 min)

```bash
curl -s -X POST http://localhost:3000/v1/matches/<matchId>/report-result \
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"winnerGroupIndex":1,"endedAt":"2026-07-09T00:00:00Z"}'
```

This triggers a `match.completed` webhook (and `rating.updated` if the game mode uses
`INTERNAL_ELO`).

## What's next

- Full endpoint reference: [`docs/api-spec-v1.md`](./api-spec-v1.md) and Swagger UI
  (`GET /v1/docs`)
- Architecture and subsystem design: [`docs/architecture.md`](./architecture.md)
- Watch pools, matches, and webhook deliveries live in the dashboard at
  `http://localhost:3001` after running `pnpm --dir apps/web dev`
