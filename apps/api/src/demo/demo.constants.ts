// Canonical identifiers for the shared demo account's showcase data. The account
// itself (user + org + project + game modes + API key) is bootstrapped once by
// apps/api/scripts/seed-demo.mjs; the demo-reset cron only refreshes the activity
// data inside this project, so these anchors must match what the script creates.

export const DEMO_PROJECT_SLUG = "demo-arena";
export const DEMO_ENVIRONMENT = "production";
export const DEMO_REGION_KEY = "global";

export const DEMO_SKILL_MODE_KEY = "skill-1v1";
export const DEMO_CASUAL_MODE_KEY = "casual-1v1";

// SystemSetting key holding the ISO timestamp of the last successful reset.
export const DEMO_LAST_RESET_SETTING_KEY = "demo:last_reset_at";

// Webhook endpoint ensured for the demo project so the Deliveries tab has data.
export const DEMO_WEBHOOK_URL = "https://demo.matchinghub.dev/webhooks";
