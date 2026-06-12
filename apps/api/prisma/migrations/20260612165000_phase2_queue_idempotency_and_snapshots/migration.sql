-- AlterTable
ALTER TABLE "queue_entries"
ADD COLUMN "dequeue_idempotency_key" TEXT,
ADD COLUMN "dequeue_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "match_slots"
ADD COLUMN "team_snapshot" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE UNIQUE INDEX "queue_entries_project_id_dequeue_idempotency_key_key"
ON "queue_entries"("project_id", "dequeue_idempotency_key");
