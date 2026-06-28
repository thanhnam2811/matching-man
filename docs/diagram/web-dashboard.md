# Web Dashboard Flow

`apps/web` (Next.js App Router). The session token stays server-side: the browser only holds an
httpOnly cookie; reads go through Server Components and writes through Server Actions, both of
which attach the token to the API call on the server. See [apps/web/DESIGN.md](../../apps/web/DESIGN.md).

## Auth, read, and mutation

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Next.js (apps/web)
    participant API as NestJS API

    Note over B,N: middleware redirects unauthenticated routes to /login

    B->>N: submit login (email, password)
    N->>API: POST /v1/auth/login
    API-->>N: { token }
    N-->>B: Set-Cookie dashboard_token (httpOnly)

    B->>N: GET /organizations/:id (cookie)
    N->>API: apiFetch — Bearer token (server-side, no-store)
    API-->>N: data (tenant-scoped)
    N-->>B: rendered HTML

    B->>N: submit form → Server Action
    N->>API: POST / PATCH / DELETE (Bearer)
    N->>N: revalidatePath() / redirect()
    N-->>B: updated UI
```

## Route map

```mermaid
flowchart TD
    Login["/login, /register<br/>(public)"]
    Home["/ — organizations<br/>+ create org"]
    Org["/organizations/:orgId<br/>projects + members"]
    Proj["/projects/:projectId<br/>overview: envs · API keys · webhooks"]
    Pools["/projects/:projectId/pools"]
    Matches["/projects/:projectId/matches"]
    Deliveries["/projects/:projectId/deliveries"]
    Ratings["/projects/:projectId/ratings"]

    Login --> Home
    Home --> Org
    Org --> Proj
    Proj --> Pools
    Proj --> Matches
    Proj --> Deliveries
    Proj --> Ratings
```

## Read vs. write

```mermaid
flowchart LR
    subgraph reads["Reads (Server Components)"]
        RC["page.tsx"] --> AF["apiFetch&lt;T&gt;()<br/>lib/api.ts"]
    end
    subgraph writes["Writes (Server Actions)"]
        FM["client manager<br/>useActionState"] --> SA["lib/actions.ts<br/>'use server'"]
        SA --> RV["revalidatePath / redirect"]
    end
    AF --> API["NestJS /v1"]
    SA --> API
```
