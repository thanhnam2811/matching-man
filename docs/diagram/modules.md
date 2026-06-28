# NestJS Module Graph

How `apps/api` modules wire together. `PrismaModule` and `AuthModule` are `@Global` so their
exports (PrismaService; the auth services + four guards) are injectable everywhere without an
explicit import. Arrows are module imports; dashed are the background processors.

```mermaid
flowchart TD
    subgraph globals["@Global (available everywhere)"]
        Prisma["PrismaModule<br/>PrismaService"]
        Auth["AuthModule<br/>AuthService, PasswordService,<br/>SessionTokenService<br/>+ DashboardAdmin / DashboardAuth /<br/>ProjectAccess / UserSession guards"]
    end

    Health["HealthModule"]
    Orgs["OrganizationsModule"]
    Projects["ProjectsModule"]
    ApiKeys["ApiKeysModule"]
    Webhooks["WebhooksModule"]
    GameModes["GameModesModule"]
    Queues["QueuesModule"]
    Matches["MatchesModule"]
    Deliveries["DeliveriesModule"]
    Ratings["RatingsModule"]
    Dashboard["DashboardModule"]

    Projects -->|imports| Orgs
    Queues -->|imports| GameModes
    Queues -->|imports| Projects
    Queues -->|imports| Deliveries
    Matches -->|imports| Deliveries
    Matches -->|imports| Ratings
    Dashboard -->|imports| Queues
    Dashboard -->|imports| Matches
    Dashboard -->|imports| Deliveries
    Dashboard -->|imports| Ratings

    QTP["QueueTimeoutProcessor<br/>@Cron 60s"]
    WRP["WebhookRetryProcessor<br/>@Cron 30s"]
    Queues -.-> QTP
    Deliveries -.-> WRP
```

## Controllers per module (route surface)

```mermaid
flowchart LR
    Auth["AuthController<br/>/auth: register, login, me, contract"]
    Orgs["Organizations + OrganizationMembers<br/>/organizations, /organizations/:id/members"]
    Projects["Projects + Environments + Members<br/>/projects, /projects/:id/environments, /members"]
    ApiKeys["ApiKeys<br/>/projects/:id/api-keys"]
    Webhooks["Webhooks<br/>/projects/:id/webhooks"]
    GameModes["GameModes<br/>/projects/:id/game-modes"]
    Queues["Queues<br/>/queues/enqueue · dequeue · pools"]
    Matches["Matches<br/>/matches/:id · /matches/:id/report-result"]
    Deliveries["Deliveries<br/>/deliveries"]
    Ratings["Ratings<br/>/ratings/history"]
    Dashboard["Dashboard<br/>/projects/:id/pools · matches · webhook-deliveries · rating-history"]
```
