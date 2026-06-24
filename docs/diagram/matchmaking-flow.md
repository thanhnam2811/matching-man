# Matchmaking & Delivery Flow

The end-to-end game-server flow: enqueue → match creation → asynchronous webhook delivery →
result report → optional Elo update. Background processors run in-process on a cron.

```mermaid
sequenceDiagram
    autonumber
    participant GS as Game Server
    participant API as NestJS API
    participant DB as Postgres
    participant W as Webhook processor<br/>(@Cron 30s)

    GS->>API: POST /v1/queues/enqueue (API key)
    API->>DB: validate mode, upsert MatchPool,<br/>create Team + TeamMembers + QueueEntry
    API->>DB: tryCreateMatch — SELECT ... FOR UPDATE SKIP LOCKED,<br/>rating-window filter (external_rating)
    alt enough candidates in window
        API->>DB: create Match + MatchSlots,<br/>mark entries MATCHED
        API->>DB: insert WebhookDelivery (match.created)
    end
    API-->>GS: { queueEntryId, status, matchId? }

    loop every 30s
        W->>DB: fetch PENDING/FAILED deliveries due
        W->>GS: POST signed payload<br/>(X-Webhook-Signature: sha256=…)
        alt 2xx
            W->>DB: status = DELIVERED
        else failure
            W->>DB: backoff (0s,30s,5m,30m,2h) → FAILED,<br/>then EXHAUSTED after 5 attempts
        end
    end

    GS->>API: POST /v1/matches/:id/report-result (API key)
    API->>DB: create MatchResult (idempotent on match),<br/>Match.status = COMPLETED
    API->>DB: insert WebhookDelivery (match.completed)
    opt ratingMode = INTERNAL_ELO and winnerGroupIndex
        API->>DB: update RatingProfiles (Elo, K=32)<br/>+ insert RatingHistory
        API->>DB: insert WebhookDelivery (rating.updated)
    end
    API-->>GS: { matchId, status: completed, ratingUpdateStatus }
```

## Queue timeout (separate cron)

```mermaid
flowchart LR
    QTP["QueueTimeoutProcessor<br/>@Cron 60s"] -->|"queued_at + maxQueueSeconds < now"| TO["mark QueueEntry TIMED_OUT"]
    TO --> WH["insert WebhookDelivery (queue.timeout)"]
```

## Concurrency safety

A queue entry is matched at most once via a transaction that locks candidate rows with
`FOR UPDATE SKIP LOCKED` and deterministic ordering (`queued_at, id`); matched entries flip to
`MATCHED` in the same transaction. Enqueue/dequeue/result are idempotent via stored keys.