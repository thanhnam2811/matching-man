# Data Model (ER)

The Prisma schema (`apps/api/prisma/schema.prisma`). Selected attributes shown; see the schema
for the full set. Tenancy lives in `Organization` / `OrganizationMember`; the matchmaking core
is `MatchPool → QueueEntry → Match → MatchSlot`, with results and ratings hanging off `Match`.

```mermaid
erDiagram
    Organization ||--o{ OrganizationMember : has
    User ||--o{ OrganizationMember : "member of"
    Organization ||--o{ Project : owns
    User ||--o{ ProjectMember : has
    Project ||--o{ ProjectMember : has
    Project ||--o{ ProjectEnvironment : has
    Project ||--o{ ApiKey : has
    Project ||--o{ WebhookEndpoint : has
    WebhookEndpoint ||--o{ WebhookDelivery : produces
    Project ||--o{ GameMode : defines
    GameMode ||--o{ MatchPool : groups
    GameMode ||--o{ RatingProfile : "rates players in"
    Project ||--o{ Team : has
    Team ||--o{ TeamMember : has
    MatchPool ||--o{ QueueEntry : holds
    Team ||--o{ QueueEntry : enqueues
    MatchPool ||--o{ Match : produces
    Match ||--o{ MatchSlot : has
    QueueEntry ||--o| MatchSlot : "placed in"
    Team ||--o{ MatchSlot : occupies
    Match ||--o| MatchResult : "ends with"
    Match ||--o{ RatingHistory : generates
    RatingProfile ||--o{ RatingHistory : tracks

    Organization {
        string id PK
        string slug UK
        string createdById FK
    }
    OrganizationMember {
        string organizationId FK
        string userId FK
        enum role "OWNER|ADMIN|MEMBER"
    }
    Project {
        string id PK
        string slug UK
        string organizationId FK
    }
    GameMode {
        enum matchStructure "VERSUS|FFA"
        enum ratingMode "INTERNAL_ELO|EXTERNAL_RATING|DISABLED"
        int requiredSlots
        int groupCount
        int initialRatingWindow "nullable"
        int windowExpandIntervalSeconds "nullable"
        int windowExpandStep "nullable"
        int maxQueueSeconds
    }
    QueueEntry {
        enum status "QUEUED|MATCHED|CANCELLED|TIMED_OUT|FAILED"
        string idempotencyKey "nullable"
        string dequeueIdempotencyKey "nullable"
    }
    Match {
        enum status "CREATED|IN_PROGRESS|COMPLETED|FAILED|EXPIRED|DISPUTED"
        int requiredSlots
        int groupCount
    }
    MatchSlot {
        int slotIndex
        int groupIndex
        json teamSnapshot
    }
    MatchResult {
        int winnerGroupIndex "nullable"
        string idempotencyKey "nullable, unique"
        datetime endedAt
    }
    RatingProfile {
        int rating "default 1200"
        int gamesPlayed
    }
    RatingHistory {
        int ratingBefore
        int ratingAfter
        int delta
    }
    WebhookDelivery {
        enum status "PENDING|DELIVERED|FAILED|EXHAUSTED"
        int attemptCount
        datetime nextRetryAt "nullable"
    }
```
