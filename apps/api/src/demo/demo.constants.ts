import { MatchStructure, RatingMode } from "../generated/prisma/client";

// Canonical identity + shape of the shared demo account. The demo-reset cron is
// self-healing: it creates the account (user + org + project + game modes + API
// key) if missing, then on every run purges any visitor-created clutter and
// restores just this project. Defaults here mean no env is required to run it;
// DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD can still override the credentials.

export const DEFAULT_DEMO_EMAIL = "demo@matchinghub.dev";
export const DEFAULT_DEMO_PASSWORD = "demo-password-123";
export const DEFAULT_DEMO_NAME = "Demo";

export const DEMO_ORG_NAME = "Demo";
export const DEMO_ORG_SLUG = "demo";

export const DEMO_PROJECT_SLUG = "demo-arena";
export const DEMO_PROJECT_NAME = "Demo Arena";
export const DEMO_ENVIRONMENT = "production";
export const DEMO_REGION_KEY = "global";

export const DEMO_SKILL_MODE_KEY = "skill-1v1";
export const DEMO_CASUAL_MODE_KEY = "casual-1v1";

// Game-mode specs the demo-reset cron bootstraps the demo project with.
export const DEMO_GAME_MODES = [
    {
        key: DEMO_SKILL_MODE_KEY,
        name: "Skill 1v1",
        matchStructure: MatchStructure.VERSUS,
        requiredSlots: 2,
        groupCount: 2,
        teamSizeMin: 1,
        teamSizeMax: 1,
        ratingMode: RatingMode.EXTERNAL_RATING,
        initialRatingWindow: 50,
        windowExpandIntervalSeconds: 3,
        windowExpandStep: 100,
    },
    {
        key: DEMO_CASUAL_MODE_KEY,
        name: "Casual 1v1",
        matchStructure: MatchStructure.VERSUS,
        requiredSlots: 2,
        groupCount: 2,
        teamSizeMin: 1,
        teamSizeMax: 1,
        ratingMode: RatingMode.DISABLED,
        initialRatingWindow: null,
        windowExpandIntervalSeconds: null,
        windowExpandStep: null,
    },
] as const;

// SystemSetting key holding the ISO timestamp of the last successful reset.
export const DEMO_LAST_RESET_SETTING_KEY = "demo:last_reset_at";

// SystemSetting key holding the raw (unhashed) current demo API key, so
// GET /demo/config can hand it to the public /demo sandbox without a
// separate manual seed step. Safe to store in the clear: it only unlocks
// the single sandboxed demo-arena project, which purges/reseeds hourly.
export const DEMO_API_KEY_SETTING_KEY = "demo:api_key";

// Webhook endpoint ensured for the demo project so the Deliveries tab has data,
// and so live matches from the public /demo sandbox (Phase 12) get a real,
// successful delivery instead of failing against a placeholder host. Points at
// this API's own sink (DemoController.webhookSink), which just logs and 200s.
export const DEMO_WEBHOOK_URL = "https://match-api.namtt.dev/v1/demo/webhook-sink";
