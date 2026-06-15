-- CreateTable: match_results
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "winner_group_index" INTEGER,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rating_profiles
CREATE TABLE "rating_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "game_mode_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 1200,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: rating_history
CREATE TABLE "rating_history" (
    "id" TEXT NOT NULL,
    "rating_profile_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rating_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_id_key" ON "match_results"("match_id");
CREATE UNIQUE INDEX "match_results_idempotency_key_key" ON "match_results"("idempotency_key");
CREATE UNIQUE INDEX "rating_profiles_project_id_game_mode_id_player_id_key" ON "rating_profiles"("project_id", "game_mode_id", "player_id");
CREATE INDEX "rating_profiles_project_id_idx" ON "rating_profiles"("project_id");
CREATE INDEX "rating_profiles_game_mode_id_idx" ON "rating_profiles"("game_mode_id");
CREATE INDEX "rating_history_rating_profile_id_idx" ON "rating_history"("rating_profile_id");
CREATE INDEX "rating_history_match_id_idx" ON "rating_history"("match_id");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rating_profiles" ADD CONSTRAINT "rating_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rating_profiles" ADD CONSTRAINT "rating_profiles_game_mode_id_fkey" FOREIGN KEY ("game_mode_id") REFERENCES "game_modes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_rating_profile_id_fkey" FOREIGN KEY ("rating_profile_id") REFERENCES "rating_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
