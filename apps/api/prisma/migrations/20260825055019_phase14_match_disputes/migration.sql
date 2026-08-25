-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "match_disputes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "claimant_team_id" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "override_winner_group_index" INTEGER,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_disputes_project_id_status_idx" ON "match_disputes"("project_id", "status");

-- CreateIndex
CREATE INDEX "match_disputes_match_id_idx" ON "match_disputes"("match_id");

-- AddForeignKey
ALTER TABLE "match_disputes" ADD CONSTRAINT "match_disputes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_disputes" ADD CONSTRAINT "match_disputes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_disputes" ADD CONSTRAINT "match_disputes_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
