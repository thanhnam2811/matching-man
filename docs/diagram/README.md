# Project Diagrams

Mermaid diagrams of how `matching-man` is actually built (phases 0–7). They render on
GitHub and in most Markdown viewers. Keep them in sync with the code when structure changes.

- [Architecture & deployment](#architecture--deployment) — this file
- [NestJS module graph](modules.md)
- [Data model (ER)](data-model.md)
- [Auth & tenancy](auth-tenancy.md)
- [Matchmaking & delivery flow](matchmaking-flow.md)
- [Web dashboard flow](web-dashboard.md)

## Architecture & deployment

Two apps in a pnpm workspace plus a managed Postgres. The dashboard talks to the API
server-side only; game servers call the public API with a project API key.

```mermaid
flowchart LR
    GS["Game Server"]
    OP["Operator / User<br/>(browser)"]

    subgraph web["apps/web — Next.js 15 (:3001)"]
        MW["middleware<br/>(cookie gate)"]
        RSC["Server Components<br/>+ Server Actions"]
    end

    subgraph api["apps/api — NestJS (:3000, /v1)"]
        HTTP["HTTP controllers + guards"]
        CRON["In-process cron<br/>webhook retry 30s<br/>queue timeout 60s"]
    end

    DB[("Neon Postgres<br/>via Prisma")]

    OP -->|HTTPS| MW --> RSC
    RSC -->|"server-side fetch<br/>(session token)"| HTTP
    GS -->|"REST + project API key"| HTTP
    HTTP --> DB
    CRON --> DB
    HTTP -. "HMAC-signed webhooks" .-> GS
    CRON -. "HMAC-signed webhooks" .-> GS
```

### Subsystems (from `docs/architecture.md`)

```mermaid
flowchart TD
    CP["Control Plane<br/>orgs, users, projects,<br/>API keys, webhooks, game modes"]
    MM["Matchmaking Engine<br/>enqueue, pools, candidate<br/>selection, match assembly"]
    RE["Rating Engine<br/>internal_elo / external_rating / disabled"]
    ED["Event Delivery<br/>signed webhooks, retry, history"]

    CP --> MM
    MM --> RE
    MM --> ED
    RE --> ED
```
