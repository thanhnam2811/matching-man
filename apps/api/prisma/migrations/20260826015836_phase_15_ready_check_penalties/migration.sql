-- CreateEnum
CREATE TYPE "SlotAcceptStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "PenaltyReason" AS ENUM ('DODGE', 'AFK_TIMEOUT', 'MANUAL_LOCKOUT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchStatus" ADD VALUE 'PENDING_ACCEPTANCE';
ALTER TYPE "MatchStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "MatchStatus" ADD VALUE 'DECLINED';
ALTER TYPE "MatchStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "game_modes" ADD COLUMN     "enable_ready_check" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ready_check_timeout_seconds" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "match_slots" ADD COLUMN     "accept_status" "SlotAcceptStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "accepted_player_ids" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "responded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "enable_dodge_penalty" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "penalty_decay_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "penalty_tiers" JSONB NOT NULL DEFAULT '[180, 900, 3600, 86400]';

-- CreateTable
CREATE TABLE "player_penalties" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "reason" "PenaltyReason" NOT NULL DEFAULT 'DODGE',
    "duration_seconds" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "violation_count" INTEGER NOT NULL DEFAULT 1,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "revocation_notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "player_penalties_project_id_player_id_expires_at_idx" ON "player_penalties"("project_id", "player_id", "expires_at");

-- CreateIndex
CREATE INDEX "player_penalties_project_id_created_at_idx" ON "player_penalties"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "player_penalties" ADD CONSTRAINT "player_penalties_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_penalties" ADD CONSTRAINT "player_penalties_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
