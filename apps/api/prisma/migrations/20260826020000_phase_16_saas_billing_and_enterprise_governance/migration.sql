-- CreateEnum
CREATE TYPE "SubscriptionPlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING', 'UNPAID');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'WEBHOOK_CREATED',
  'WEBHOOK_UPDATED',
  'WEBHOOK_DELETED',
  'GAME_MODE_CREATED',
  'GAME_MODE_UPDATED',
  'GAME_MODE_DELETED',
  'MATCH_POOL_UPDATED',
  'PROJECT_MEMBER_INVITED',
  'PROJECT_MEMBER_ROLE_UPDATED',
  'PROJECT_MEMBER_REMOVED',
  'ORGANIZATION_MEMBER_ROLE_UPDATED',
  'ORGANIZATION_MEMBER_REMOVED',
  'DISPUTE_RESOLVED',
  'DISPUTE_REJECTED',
  'PENALTY_MANUAL_LOCKOUT',
  'PENALTY_REVOKED',
  'SUBSCRIPTION_TIER_CHANGED',
  'PROJECT_SETTINGS_UPDATED'
);

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM (
  'API_KEY',
  'WEBHOOK_ENDPOINT',
  'GAME_MODE',
  'MATCH_POOL',
  'PROJECT_MEMBER',
  'ORGANIZATION_MEMBER',
  'DISPUTE',
  'PENALTY',
  'PROJECT',
  'ORGANIZATION',
  'SUBSCRIPTION'
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "plan_tier" "SubscriptionPlanTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "last_event_created_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_metrics_daily" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "enqueue_requests" INTEGER NOT NULL DEFAULT 0,
    "matches_created" INTEGER NOT NULL DEFAULT 0,
    "webhook_deliveries" INTEGER NOT NULL DEFAULT 0,
    "peak_active_pools" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT,
    "actor_user_id" TEXT,
    "actor_ip" TEXT,
    "actor_user_agent" TEXT,
    "action" "AuditAction" NOT NULL,
    "target_resource_type" "AuditResourceType" NOT NULL,
    "target_resource_id" TEXT NOT NULL,
    "metadata_before" JSONB,
    "metadata_after" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_webhook_events_status_created_at_idx" ON "stripe_webhook_events"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions"("stripe_customer_id");
CREATE INDEX "subscriptions_status_plan_tier_idx" ON "subscriptions"("status", "plan_tier");

-- CreateIndex
CREATE UNIQUE INDEX "usage_metrics_daily_project_id_date_key" ON "usage_metrics_daily"("project_id", "date");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");
CREATE INDEX "audit_logs_project_id_created_at_idx" ON "audit_logs"("project_id", "created_at");
CREATE INDEX "audit_logs_project_id_action_created_at_idx" ON "audit_logs"("project_id", "action", "created_at");
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_used_at_idx" ON "password_reset_tokens"("user_id", "used_at");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_used_at_idx" ON "email_verification_tokens"("user_id", "used_at");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_metrics_daily" ADD CONSTRAINT "usage_metrics_daily_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
