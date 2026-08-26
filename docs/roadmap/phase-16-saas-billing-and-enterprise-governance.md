# Phase 16: SaaS Monetization, Usage Metering & Enterprise Governance

## Status

- [ ] Scheduled

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

- [ ] **Email Service Module (`apps/api/src/email`):**
    - Configurable transport adapter supporting Resend SDK & Nodemailer (SMTP fallback).
    - Environment variables: `RESEND_API_KEY`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
    - Clean HTML/Text email templates for:
        - Password Reset link with 15-minute expiration.
        - Account Welcome & Email Verification.
- [ ] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `PasswordResetToken` model (`id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`).
    - Add `EmailVerificationToken` model (`id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`).
    - Add `emailVerified` (`Boolean`, default `false`) to `User` model.
- [ ] **Auth Endpoints (`apps/api/src/auth`):**
    - `POST /v1/auth/forgot-password`: Generates cryptographic token, stores SHA-256 hash, dispatches reset email (timing-attack safe).
    - `POST /v1/auth/reset-password`: Validates token hash, updates user password, marks token used, and invalidates existing sessions.
    - `POST /v1/auth/verify-email`: Validates verification token and confirms email.
- [ ] **Next.js Auth Pages (`apps/web`):**
    - `/forgot-password`: Email submission form.
    - `/reset-password`: Token validation and password creation form.
    - `/verify-email`: Confirmation landing page.

**Exit criteria:** Users can recover forgotten passwords, verify email addresses, and receive transactional emails reliably.

---

### Stage 2 — Control-Plane Audit Logging Engine

Track, record, and inspect all critical administrative mutations across projects and organizations.

- [ ] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `AuditAction` enum (API keys, webhooks, game modes, pools, disputes, penalties, members, billing).
    - Add `AuditResourceType` enum.
    - Add `AuditLog` model (`id`, `organizationId`, `projectId`, `actorUserId`, `actorIp`, `actorUserAgent`, `action`, `targetResourceType`, `targetResourceId`, `metadataBefore`, `metadataAfter`, `description`, `createdAt`).
- [ ] **Audit Interceptor & Decorator (`apps/api/src/audit-logs`):**
    - Create `@AuditAction()` metadata decorator.
    - Create `AuditLogInterceptor` to capture pre/post mutation states and persist asynchronously to DB.
    - Annotate critical controllers:
        - API Keys: Create, Revoke.
        - Webhooks: Create, Update, Delete.
        - Game Modes: Create, Update, Delete.
        - Match Pools: Update rules.
        - Project Members: Invite, Update Role, Remove.
        - Disputes: Resolve, Reject.
        - Penalties: Manual Lockout, Pardon/Revoke.
- [ ] **Audit Log Query API:**
    - `GET /v1/projects/:id/audit-logs` (Filterable by action, actor, date range, with pagination).
    - `GET /v1/organizations/:id/audit-logs`.
- [ ] **Operator Audit Log Explorer (`apps/web`):**
    - Project navigation: **Audit Logs** (`/dashboard/projects/[projectId]/audit-logs`).
    - Filterable table with color-coded action badges.
    - Interactive 2-column JSON Diff modal comparing `metadataBefore` vs `metadataAfter`.

**Exit criteria:** Every administrative action is immutably logged with actor attribution and verifiable diff history.

---

### Stage 3 — Usage Metering & Quota Guard Engine

Track resource consumption in real-time with Redis aggregation and enforce plan limits without bottlenecking matchmaking.

- [ ] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `UsageMetricDaily` model (`id`, `projectId`, `date`, `enqueueRequests`, `matchesCreated`, `webhookDeliveries`, `peakActivePools`).
- [ ] **Asynchronous Metering Collector (`apps/api/src/metering`):**
    - In-memory / Redis fast counters (`usage:{projectId}:{YYYY-MM-DD}:*`).
    - Increment hooks in Enqueue service, Match Assembler, and Webhook Delivery worker.
    - BullMQ scheduled daily rollup worker (`flush-daily-usage`) syncing Redis counters to `UsageMetricDaily`.
- [ ] **Quota Definitions & Enforcement Guard (`QuotaGuard`):**
    - Define tier limits (`FREE`: 5k matches, 25k enqueues, 5 pools; `PRO`: 100k matches, 500k enqueues, 30 pools; `ENTERPRISE`: unmetered).
    - Fast quota check in Enqueue pipeline: Return `402 Payment Required` with upgrade instructions if monthly limit is exceeded.
- [ ] **Usage Statistics API:**
    - `GET /v1/organizations/:id/billing/usage`: Returns current month totals vs plan quotas.

**Exit criteria:** Usage metrics are aggregated without degrading API latency, and quota limits prevent resource exhaustion.

---

### Stage 4 — Stripe Billing & Customer Portal

Automate monetization with Stripe Checkout, subscription lifecycle webhooks, and self-service billing management.

- [ ] **Prisma Schema Updates (`apps/api/prisma/schema.prisma`):**
    - Add `SubscriptionPlanTier` (`FREE`, `PRO`, `ENTERPRISE`) and `SubscriptionStatus` (`ACTIVE`, `PAST_DUE`, `CANCELED`, `TRIALING`, `UNPAID`).
    - Add `Subscription` model (`id`, `organizationId`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `planTier`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`).
- [ ] **Stripe Billing Module (`apps/api/src/billing`):**
    - Stripe Node SDK integration with environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`).
    - `POST /v1/organizations/:id/billing/checkout`: Initiates Stripe Checkout for Pro/Enterprise tier.
    - `POST /v1/organizations/:id/billing/portal`: Generates Stripe Customer Portal session.
    - `GET /v1/organizations/:id/billing/subscription`: Fetches active subscription details.
- [ ] **Stripe Webhook Consumer (`POST /v1/billing/webhook`):**
    - Validates `stripe-signature` raw body.
    - Handles events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
    - Updates `Subscription` and adjusts organization plan tier accordingly.

**Exit criteria:** Organizations can upgrade to Pro via Stripe, manage billing in Stripe Portal, and webhooks synchronize subscription state.

---

### Stage 5 — Admin UI & Operator Experience

Deliver a polished billing and management interface in `apps/web`.

- [ ] **Organization Billing Page (`/dashboard/organizations/[orgId]/billing`):**
    - Plan summary card with status badges.
    - Live usage progress bars (Matches, Enqueues, Active Pools).
    - "Upgrade to Pro" Checkout button & "Manage Billing" Customer Portal link.
- [ ] **Settings Integration:**
    - Organization Settings navigation tab: **Billing & Plans**.
    - Project Settings: Display current project usage contribution.
- [ ] **Auth Flow Polish:**
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
