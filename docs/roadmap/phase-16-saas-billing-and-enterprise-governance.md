# Phase 16: SaaS Monetization, Usage Metering & Enterprise Governance

## Status

- [x] Complete (2026-08-26)

## Objective

Transform `matching-man` from a purely technical matchmaking engine into a production-grade, commercial **B2B Matchmaking SaaS Platform** with comprehensive monetization, resource accounting, security compliance, and self-service governance:

1. **SaaS Monetization & Stripe Billing:** Automated subscription lifecycle (`FREE`, `PRO`, `ENTERPRISE`), Stripe Checkout integration, self-service Customer Portal, and automated webhook reconciliation.
2. **Real-Time Usage Metering & Quotas:** Asynchronous Redis counter aggregation flushed to PostgreSQL daily rollups (`UsageMetricDaily`) with non-blocking `QuotaGuard` enforcement across Enqueues, Matches, and Active Pools.
3. **Control-Plane Audit Trails:** An automatic NestJS `@AuditAction()` interceptor capturing complete `before` vs `after` state diffs and actor attribution for all critical operations (Game Modes, API Keys, Webhooks, Disputes, Penalties, Members).
4. **Auth Lifecycle & Security Governance:** Transactional email integration (Resend / SMTP), secure 15-minute SHA-256 hashed Password Reset tokens, Email Verification, and optional Social OAuth authentication.
5. **Operator & Tenant Dashboard Experience:** Dedicated Billing & Usage progress metrics, filterable Audit Log Explorer with visual JSON diffing, and complete authentication recovery views in `apps/web`.

Graduated from:

- `docs/roadmap/backlog.md`: Auth and Platform (_"Org-level billing / usage metering"_, _"Audit log for control-plane mutations"_, _"Email verification and password reset flows"_, _"OAuth / social login"_).

---

## Stages

### Stage 1 — Auth Lifecycle & Transactional Email Service

Implement a robust email communication adapter and self-service account recovery flows.

- [x] **Email Service Module (`apps/api/src/email`):**
    - Configurable transport adapter supporting Resend SDK & Nodemailer (SMTP fallback).
    - Environment variables: `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
    - Clean HTML/Text email templates for:
        - Password Reset link with 15-minute expiration.
        - Account Welcome & Email Verification.
- [x] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `PasswordResetToken` model (`id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`).
    - Add `EmailVerificationToken` model (`id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`).
    - Add `emailVerified` (`Boolean`, default `false`) to `User` model.
- [x] **Auth Endpoints (`apps/api/src/auth`):**
    - `POST /v1/auth/forgot-password`: Generates cryptographic token, stores SHA-256 hash, dispatches reset email (timing-attack safe).
    - `POST /v1/auth/reset-password`: Validates token hash, updates user password, marks token used, and invalidates existing sessions.
    - `POST /v1/auth/verify-email`: Validates verification token and confirms email.
- [x] **Next.js Auth Pages (`apps/web`):**
    - `/forgot-password`: Email submission form.
    - `/reset-password`: Token validation and password creation form.
    - `/verify-email`: Confirmation landing page.

**Exit criteria:** Users can recover forgotten passwords, verify email addresses, and receive transactional emails reliably.

---

### Stage 2 — Control-Plane Audit Logging Engine

Track, record, and inspect all critical administrative mutations across projects and organizations with asynchronous persistence and sensitive data redaction.

- [x] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `AuditAction` and `AuditResourceType` enums.
    - Add `AuditLog` model with indexes on `[organizationId, createdAt]`, `[projectId, createdAt]`, `[projectId, action, createdAt]`, and `[actorUserId]`.
- [x] **Audit Interceptor & Decorator (`apps/api/src/audit-logs`):**
    - Create `@AuditAction()` metadata decorator.
    - Create `AuditLogInterceptor` with automatic recursive key sanitizer (`[REDACTED]` for `hashedKey`, `secret`, `passwordHash`, credit card tokens).
    - Asynchronous persistence decoupled from request execution via BullMQ/event bus with 32KB payload size cap.
    - Annotate critical controllers: API Keys, Webhooks, Game Modes, Match Pools, Project Members, Disputes, Penalties.
- [x] **Audit Log Query API:**
    - `GET /v1/projects/:id/audit-logs` (Filterable by action, actor, date range, with pagination).
    - `GET /v1/organizations/:id/audit-logs`.
- [x] **Operator Audit Log Explorer (`apps/web`):**
    - Project navigation: **Audit Logs** (`/dashboard/projects/[projectId]/audit-logs`).
    - Filterable table with monochrome zinc action badges (`default`/`secondary` for creations, `warning` for modifications, `destructive` for deletions/lockouts, `success` for resolutions/pardons).
    - Interactive 2-column JSON Diff slide-over sheet (`<DetailDrawer size="wide">` per `apps/web/DESIGN.md`) comparing `metadataBefore` vs `metadataAfter`.

**Exit criteria:** Every administrative action is immutably logged with actor attribution, safe redaction, and verifiable diff history.

---

### Stage 3 — Usage Metering & Quota Guard Engine

Track resource consumption in real-time with atomic Redis Hash counters and enforce plan limits without bottlenecking matchmaking.

- [x] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `UsageMetricDaily` model with composite unique index on `[projectId, date]`.
- [x] **Asynchronous Metering Collector (`apps/api/src/metering`):**
    - Date-partitioned Redis Hashes (`usage:{projectId}:{YYYY-MM-DD}`) with 7-day TTL applied atomically on creation.
    - Active project registration set (`usage:active-projects:{YYYY-MM-DD}`) eliminating global Redis scans.
    - Non-blocking, fire-and-forget increments in Enqueue service, Match Assembler, and Webhook Delivery worker.
    - BullMQ daily rollup worker (`flush-daily-usage`): Batched (50–100 items) idempotent upsert using `GREATEST(...)` into `UsageMetricDaily`.
- [x] **Quota Definitions & Multi-Tier Caching Guard (`QuotaGuard`):**
    - Define tier limits (`FREE`: 5k matches, 25k enqueues, 5 pools; `PRO`: 100k matches, 500k enqueues, 30 pools; `ENTERPRISE`: unmetered).
    - 2-tier cache (L1 In-Memory LRU + L2 Redis Snapshot) with strict **Fail-Open Policy** during Redis outages to protect core matchmaking SLA.
    - Return `402 Payment Required` with usage metrics and upgrade links when monthly quota is exhausted.
- [x] **Usage Statistics API:**
    - `GET /v1/organizations/:id/billing/usage`: Returns current month totals vs plan quotas.

**Exit criteria:** Usage metrics are aggregated with sub-millisecond overhead, and quota limits prevent resource exhaustion.

---

### Stage 4 — Stripe Billing & Customer Portal

Automate monetization with Stripe Checkout, subscription lifecycle webhooks, and self-service billing management.

- [x] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `SubscriptionPlanTier` (`FREE`, `PRO`, `ENTERPRISE`), `SubscriptionStatus` (`ACTIVE`, `PAST_DUE`, `CANCELED`, `TRIALING`, `UNPAID`), and `WebhookProcessingStatus` (`PROCESSING`, `COMPLETED`, `FAILED`).
    - Add `Subscription` model (`lastEventCreatedAt`, `cancelAtPeriodEnd`, `currentPeriodEnd`).
    - Add `StripeWebhookEvent` model for distributed webhook deduplication.
- [x] **Stripe Billing Module (`apps/api/src/billing`):**
    - Preserve raw request buffer in `main.ts` for HMAC signature validation.
    - Stripe Node SDK integration with environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`).
    - `POST /v1/organizations/:id/billing/checkout`: Initiates Stripe Checkout with server-side sanitized return URLs.
    - `POST /v1/organizations/:id/billing/portal`: Generates Stripe Customer Portal session for `OWNER`/`ADMIN` roles.
    - `GET /v1/organizations/:id/billing/subscription`: Fetches active subscription details.
- [x] **Stripe Webhook Consumer (`POST /v1/billing/webhook`):**
    - Verifies `stripe-signature` with 300s clock skew tolerance.
    - Idempotent execution claiming events via `StripeWebhookEvent`.
    - Stale / out-of-order event guard comparing `event.created * 1000 < lastEventCreatedAt`.
    - Handles events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` (with 7-day soft dunning grace window before quota restriction).

**Exit criteria:** Organizations can upgrade to Pro via Stripe, manage billing in Stripe Portal, and webhooks synchronize subscription state.

---

### Stage 5 — Admin UI & Operator Experience

Deliver a polished billing and management interface in `apps/web`.

- [x] **Organization Billing Page (`/dashboard/organizations/[orgId]/billing`):**
    - Plan summary card with status badges.
    - Live usage progress bars (Matches, Enqueues, Active Pools).
    - "Upgrade to Pro" Checkout button & "Manage Billing" Customer Portal link.
- [x] **Settings Integration:**
    - Organization Settings navigation tab: **Billing & Plans**.
    - Project Settings: Display current project usage contribution.
- [x] **Auth Flow Polish:**
    - Update `/login` with "Forgot password?" link.
    - Embed password reset and verification pages with matching minimalist Zinc design system.

**Exit criteria:** Operators and studio managers can inspect usage, upgrade plans, review audit logs, and recover credentials seamlessly.

---

## Deliverables & Testing

1. **Unit & Integration Tests:**
    - Password reset token generation, hashing, expiration, and single-use enforcement.
    - Audit interceptor diff calculation and asynchronous persistence.
    - Redis usage counter increments and BullMQ DB flush accuracy.
    - Quota guard evaluations for compliant vs over-quota requests.
    - Stripe webhook handler idempotency and signature verification.
2. **E2E Tests:**
    - Forgot Password → Reset Password → Successful login with new credentials.
    - Stripe Checkout Webhook → Subscription activated → Quota limits extended.
    - Configuration change → Audit log record verified with actor and JSON diff.
3. **Documentation Updates:**
    - Update `docs/api-spec-v1.md` with new auth, audit, and billing endpoints.
    - Update `docs/architecture.md` with billing, metering, and audit subsystems.
