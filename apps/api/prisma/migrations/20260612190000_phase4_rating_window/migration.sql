-- AlterTable
ALTER TABLE "game_modes" ADD COLUMN "initial_rating_window" INTEGER;
ALTER TABLE "game_modes" ADD COLUMN "window_expand_interval_seconds" INTEGER;
ALTER TABLE "game_modes" ADD COLUMN "window_expand_step" INTEGER;
