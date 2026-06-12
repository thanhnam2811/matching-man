-- CreateEnum
CREATE TYPE "RatingMode" AS ENUM ('INTERNAL_ELO', 'EXTERNAL_RATING', 'DISABLED');

-- CreateEnum
CREATE TYPE "MatchStructure" AS ENUM ('VERSUS', 'FFA');

-- CreateEnum
CREATE TYPE "QueueEntryStatus" AS ENUM ('QUEUED', 'MATCHED', 'CANCELLED', 'TIMED_OUT', 'FAILED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'EXPIRED', 'DISPUTED');

-- CreateTable
CREATE TABLE "game_modes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "match_structure" "MatchStructure" NOT NULL,
    "required_slots" INTEGER NOT NULL,
    "group_count" INTEGER NOT NULL,
    "team_size_min" INTEGER NOT NULL,
    "team_size_max" INTEGER NOT NULL,
    "rating_mode" "RatingMode" NOT NULL DEFAULT 'DISABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_modes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_pools" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "game_mode_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "region_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "external_team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rating_snapshot" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "game_mode_id" TEXT NOT NULL,
    "match_pool_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "region_key" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "rating_mode" "RatingMode" NOT NULL,
    "status" "QueueEntryStatus" NOT NULL DEFAULT 'QUEUED',
    "metadata" JSONB,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "game_mode_id" TEXT NOT NULL,
    "match_pool_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "region_key" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'CREATED',
    "rating_mode" "RatingMode" NOT NULL,
    "required_slots" INTEGER NOT NULL,
    "group_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_slots" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "queue_entry_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL,
    "group_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_modes_project_id_idx" ON "game_modes"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_modes_project_id_key_key" ON "game_modes"("project_id", "key");

-- CreateIndex
CREATE INDEX "match_pools_project_id_idx" ON "match_pools"("project_id");

-- CreateIndex
CREATE INDEX "match_pools_game_mode_id_idx" ON "match_pools"("game_mode_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_pools_project_id_game_mode_id_environment_region_key_key" ON "match_pools"("project_id", "game_mode_id", "environment", "region_key");

-- CreateIndex
CREATE INDEX "teams_project_id_idx" ON "teams"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_project_id_external_team_id_key" ON "teams"("project_id", "external_team_id");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_player_id_key" ON "team_members"("team_id", "player_id");

-- CreateIndex
CREATE INDEX "queue_entries_match_pool_id_status_queued_at_idx" ON "queue_entries"("match_pool_id", "status", "queued_at");

-- CreateIndex
CREATE INDEX "queue_entries_project_id_idx" ON "queue_entries"("project_id");

-- CreateIndex
CREATE INDEX "queue_entries_game_mode_id_idx" ON "queue_entries"("game_mode_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_entries_project_id_idempotency_key_key" ON "queue_entries"("project_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "matches_project_id_idx" ON "matches"("project_id");

-- CreateIndex
CREATE INDEX "matches_game_mode_id_idx" ON "matches"("game_mode_id");

-- CreateIndex
CREATE INDEX "matches_match_pool_id_idx" ON "matches"("match_pool_id");

-- CreateIndex
CREATE INDEX "match_slots_team_id_idx" ON "match_slots"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_slots_match_id_slot_index_key" ON "match_slots"("match_id", "slot_index");

-- CreateIndex
CREATE UNIQUE INDEX "match_slots_queue_entry_id_key" ON "match_slots"("queue_entry_id");

-- AddForeignKey
ALTER TABLE "game_modes" ADD CONSTRAINT "game_modes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_pools" ADD CONSTRAINT "match_pools_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_pools" ADD CONSTRAINT "match_pools_game_mode_id_fkey" FOREIGN KEY ("game_mode_id") REFERENCES "game_modes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_game_mode_id_fkey" FOREIGN KEY ("game_mode_id") REFERENCES "game_modes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_match_pool_id_fkey" FOREIGN KEY ("match_pool_id") REFERENCES "match_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_game_mode_id_fkey" FOREIGN KEY ("game_mode_id") REFERENCES "game_modes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_pool_id_fkey" FOREIGN KEY ("match_pool_id") REFERENCES "match_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_queue_entry_id_fkey" FOREIGN KEY ("queue_entry_id") REFERENCES "queue_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
