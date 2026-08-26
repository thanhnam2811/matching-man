# Phase 16: SaaS Monetization, Usage Metering & Enterprise Governance — Design

## Status

- [x] Approved / Planned

## Objective

Transform `matching-man` from a purely technical matchmaking engine into a production-grade, commercial **B2B Matchmaking SaaS Platform** with comprehensive monetization, resource accounting, security compliance, and self-service governance:

1. **SaaS Monetization & Stripe Billing:** Automated subscription lifecycle (`FREE`, `PRO`, `ENTERPRISE`), Stripe Checkout integration, self-service Customer Portal, and automated webhook reconciliation.
2. **Real-Time Usage Metering & Quotas:** Asynchronous Redis counter aggregation flushed to PostgreSQL daily rollups (`UsageMetricDaily`) with non-blocking `QuotaGuard` enforcement across Enqueues, Matches, and Active Pools.
3. **Control-Plane Audit Trails:** An automatic NestJS `@AuditAction()` interceptor capturing complete `before` vs `after` state diffs and actor attribution for all critical operations (Game Modes, API Keys, Webhooks, Disputes, Penalties, Members).
4. **Auth Lifecycle & Security Governance:** Transactional email integration (Resend / SMTP), secure 15-minute SHA-256 hashed Password Reset tokens, Email Verification, and optional Social OAuth authentication.
5. **Operator & Tenant Dashboard Experience:** Dedicated Billing & Usage progress metrics, filterable Audit Log Explorer with visual JSON diffing, and complete authentication recovery views in `apps/web`.

Graduated from `docs/roadmap/backlog.md` ("Org-level billing / usage metering", "Audit log for control-plane mutations", "Email verification and password reset flows", "OAuth / social login").

---

## 1. Architecture & Subsystems

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       APPS / WEB (Next.js)                                  │
│  - Billing & Usage (/billing)       - Audit Log Explorer (/audit-logs) - Auth (/forgot-pw) │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       APPS / API (NestJS)                                   │
│                                                                                             │
│  ┌──────────────────────┐   ┌───────────────────────┐   ┌────────────────────────────────┐  │
│  │    BillingModule     │   │     AuditLogModule    │   │         Auth & Email           │  │
│  │ - Stripe Webhooks    │   │ - @AuditAction() Dec. │   │ - Resend / Nodemailer Adapter  │  │
│  │ - Checkout & Portal  │   │ - State Diff Engine   │   │ - Password Reset Tokens        │  │
│  │ - QuotaGuard Check   │   │ - Filterable Query API│   │ - Email Verification Flow      │  │
│  └──────────┬───────────┘   └───────────┬───────────┘   └────────────────┬───────────────┘  │
└─────────────┼───────────────────────────┼────────────────────────────────┼──────────────────┘
              │                           │                                │
              ▼                           ▼                                ▼
┌───────────────────────────┐   ┌─────────────────────────────────────────────────────────────┐
│      REDIS / BULLMQ       │   │                    POSTGRESQL (Prisma ORM)                  │
│ - Live Usage Counters     │   │ - Subscriptions        - AuditLogs                          │
│ - Flush Usage Daily Cron  │   │ - UsageMetricDaily     - PasswordReset / Verify Tokens      │
└───────────────────────────┘   └─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model & Prisma Schema Extensions

```prisma
// ==========================================
// Enums
// ==========================================

enum SubscriptionPlanTier {
  FREE
  PRO
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
  UNPAID
}

enum AuditAction {
  // Security & Credentials
  API_KEY_CREATED
  API_KEY_REVOKED
  WEBHOOK_CREATED
  WEBHOOK_UPDATED
  WEBHOOK_DELETED

  // Game & Match Rules
  GAME_MODE_CREATED
  GAME_MODE_UPDATED
  GAME_MODE_DELETED
  MATCH_POOL_UPDATED

  // Access & Membership
  PROJECT_MEMBER_INVITED
  PROJECT_MEMBER_ROLE_UPDATED
  PROJECT_MEMBER_REMOVED
  ORGANIZATION_MEMBER_ROLE_UPDATED
  ORGANIZATION_MEMBER_REMOVED

  // Operations & Moderation
  DISPUTE_RESOLVED
  DISPUTE_REJECTED
  PENALTY_MANUAL_LOCKOUT
  PENALTY_REVOKED

  // Billing & Project Config
  SUBSCRIPTION_TIER_CHANGED
  PROJECT_SETTINGS_UPDATED
}

enum AuditResourceType {
  API_KEY
  WEBHOOK_ENDPOINT
  GAME_MODE
  MATCH_POOL
  PROJECT_MEMBER
  ORGANIZATION_MEMBER
  DISPUTE
  PENALTY
  PROJECT
  ORGANIZATION
  SUBSCRIPTION
}

// ==========================================
// Models
// ==========================================

model User {
  // ... existing fields
  emailVerified          Boolean            @default(false) @map("email_verified")
  tokenVersion           Int                @default(0) @map("token_version")
  passwordResetTokens    PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]
}

model Organization {
  // ... existing fields
  subscription           Subscription?
  auditLogs              AuditLog[]
}

model Project {
  // ... existing fields
  usageMetricsDaily      UsageMetricDaily[]
  auditLogs              AuditLog[]
}

model Subscription {
  id                   String               @id @default(cuid())
  organizationId       String               @unique @map("organization_id")
  stripeCustomerId     String               @unique @map("stripe_customer_id")
  stripeSubscriptionId String?              @unique @map("stripe_subscription_id")
  stripePriceId        String?              @map("stripe_price_id")
  planTier             SubscriptionPlanTier @default(FREE) @map("plan_tier")
  status               SubscriptionStatus   @default(ACTIVE) @map("status")
  currentPeriodStart   DateTime?            @map("current_period_start")
  currentPeriodEnd     DateTime?            @map("current_period_end")
  cancelAtPeriodEnd    Boolean              @default(false) @map("cancel_at_period_end")
  createdAt            DateTime             @default(now()) @map("created_at")
  updatedAt            DateTime             @updatedAt @map("updated_at")

  organization         Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("subscriptions")
}

model UsageMetricDaily {
  id                 String   @id @default(cuid())
  projectId          String   @map("project_id")
  date               DateTime @db.Date @map("date")
  enqueueRequests    Int      @default(0) @map("enqueue_requests")
  matchesCreated     Int      @default(0) @map("matches_created")
  webhookDeliveries  Int      @default(0) @map("webhook_deliveries")
  peakActivePools    Int      @default(0) @map("peak_active_pools")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  project            Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, date])
  @@index([projectId, date])
  @@map("usage_metrics_daily")
}

model AuditLog {
  id                 String            @id @default(cuid())
  organizationId     String            @map("organization_id")
  projectId          String?           @map("project_id")
  actorUserId        String?           @map("actor_user_id")
  actorIp            String?           @map("actor_ip")
  actorUserAgent     String?           @map("actor_user_agent")
  action             AuditAction       @map("action")
  targetResourceType AuditResourceType @map("target_resource_type")
  targetResourceId   String            @map("target_resource_id")
  metadataBefore     Json?             @map("metadata_before")
  metadataAfter      Json?             @map("metadata_after")
  description        String?           @map("description")
  createdAt          DateTime          @default(now()) @map("created_at")

  organization       Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  project            Project?          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  actorUser          User?             @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([organizationId, createdAt])
  @@index([projectId, createdAt])
  @@index([actorUserId])
  @@map("audit_logs")
}

model PasswordResetToken {
  id                 String    @id @default(cuid())
  userId             String    @map("user_id")
  tokenHash          String    @unique @map("token_hash")
  expiresAt          DateTime  @map("expires_at")
  usedAt             DateTime? @map("used_at")
  createdAt          DateTime  @default(now()) @map("created_at")

  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash, expiresAt])
  @@map("password_reset_tokens")
}

model EmailVerificationToken {
  id                 String    @id @default(cuid())
  userId             String    @map("user_id")
  tokenHash          String    @unique @map("token_hash")
  expiresAt          DateTime  @map("expires_at")
  usedAt             DateTime? @map("used_at")
  createdAt          DateTime  @default(now()) @map("created_at")

  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tokenHash, expiresAt])
  @@map("email_verification_tokens")
}
```

---

## 3. Quota Tier Specifications

| Feature / Limit            | Free (Hobby)        | Pro ($49 / mo)       | Enterprise (Custom)          |
| :------------------------- | :------------------ | :------------------- | :--------------------------- |
| **Monthly Matches**        | 5,000 matches       | 100,000 matches      | Unlimited                    |
| **Monthly Enqueues**       | 25,000 enqueues     | 500,000 enqueues     | Unlimited                    |
| **Concurrent Match Pools** | 5 active pools      | 30 active pools      | Unlimited                    |
| **Webhook Endpoints**      | 2 endpoints         | 10 endpoints         | Unlimited                    |
| **Project Members**        | 3 members / project | 10 members / project | Unlimited                    |
| **Audit Log Retention**    | 7 days              | 90 days              | 365 days                     |
| **Support & SLA**          | Community           | Priority Email       | 99.99% SLA & Dedicated Slack |

---

## 4. API Endpoints & Core Flows

### 4.1 Authentication & Email Lifecycle

- `POST /v1/auth/forgot-password` (Body: `{ email: string }`):
    - Generates secure 32-byte hex token, hashes with SHA-256, stores in `PasswordResetToken` with 15-minute expiry.
    - Asynchronously sends transactional reset link email via `EmailService`.
    - Always returns `200 OK` (timing-attack resistant) to prevent email enumeration.
- `POST /v1/auth/reset-password` (Body: `{ token: string, newPassword: string }`):
    - Hashes input token and checks against valid, unexpired, unused token.
    - Updates `User.passwordHash` using argon2/scrypt, marks token `usedAt = now()`.
    - Revokes all existing user sessions.
- `POST /v1/auth/verify-email` (Body: `{ token: string }`):
    - Validates token and marks `User.emailVerified = true`.

### 4.2 Control-Plane Audit Logs

- `GET /v1/projects/:id/audit-logs?page=1&limit=50&action=...&actorUserId=...`
    - Returns paginated list of audit records with actor details, timestamps, and before/after metadata.
- `GET /v1/organizations/:id/audit-logs?page=1&limit=50`
    - Returns organization-wide audit logs spanning all projects.

### 4.3 Stripe Billing & Quotas

- `GET /v1/organizations/:id/billing/subscription`
    - Returns current plan tier, status, renewal date, and live quota utilization.
- `POST /v1/organizations/:id/billing/checkout` (Body: `{ planTier: 'PRO' | 'ENTERPRISE', returnUrl: string }`):
    - Creates or retrieves Stripe Customer, initiates Stripe Checkout Session, returns `{ checkoutUrl }`.
- `POST /v1/organizations/:id/billing/portal` (Body: `{ returnUrl: string }`):
    - Creates Stripe Billing Portal Session, returns `{ portalUrl }`.
- `POST /v1/billing/webhook` (Raw Stripe event):
    - Verifies `stripe-signature` header using `STRIPE_WEBHOOK_SECRET`.
    - Handled events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

---

## 5. UI / Dashboard Specifications (`apps/web`)

1. **Organization Billing View (`/dashboard/organizations/[orgId]/billing`):**
    - Plan summary card with status badges (`Active`, `Past Due`, `Canceled`).
    - Visual usage progress bars: Matches (e.g. `4,120 / 5,000`), Enqueues, Active Pools.
    - Upgrade to Pro / Manage Subscription via Stripe Portal button.
2. **Project Audit Log Explorer (`/dashboard/projects/[projectId]/audit-logs`):**
    - Action badges with risk color coding (`RED` for Deletions/Revocations, `AMBER` for Modifications, `BLUE` for Creations, `GREEN` for Dispute/Penalty resolutions).
    - Interactive Slide-Over Diff Drawer (`<DetailDrawer>` per `apps/web/DESIGN.md`): Visual 2-column before vs after JSON inspector highlighting modified keys with sensitive data auto-redacted (`[REDACTED]`).
3. **Auth Recovery Pages:**
    - `/forgot-password`: Email submission form with spam throttling and success state.
    - `/reset-password?token=...`: New password form with strength validator.
    - `/verify-email?token=...`: Email confirmation landing page.

---

## 6. Testing & Acceptance Criteria

1. **Unit & Service Tests:**
    - Password reset token generation, hashing, expiration (15 min), and one-time use constraint.
    - Audit interceptor correctly records mutation diffs without blocking fast-path responses.
    - Redis usage counter increment and daily DB flush job accuracy.
    - Quota guard properly evaluates monthly usage and halts requests when quota is breached.
    - Stripe webhook signature verification and idempotency handling.
2. **E2E Integration Tests:**
    - Complete Forgot Password → Reset Password → Login flow.
    - Complete Stripe Checkout Webhook → Subscription Active → Quota extended flow.
    - GameMode updated → Audit log record verified with previous and new JSON settings.
