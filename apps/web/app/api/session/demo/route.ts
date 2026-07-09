import { loginAndSetSessionCookie } from "@/lib/api";

// Credentials for the shared demo account. The API auto-provisions this account
// (see apps/api/src/demo), so these defaults work with no env configured;
// DEMO_ACCOUNT_EMAIL / DEMO_ACCOUNT_PASSWORD can still override them if changed.
const DEFAULT_DEMO_EMAIL = "demo@matchinghub.dev";
const DEFAULT_DEMO_PASSWORD = "demo-password-123";

/**
 * One-click demo login. Signs the visitor into the shared demo account
 * server-side — no body required, credentials never reach the browser.
 */
export async function POST() {
    const email = process.env.DEMO_ACCOUNT_EMAIL?.trim() || DEFAULT_DEMO_EMAIL;
    const password = process.env.DEMO_ACCOUNT_PASSWORD || DEFAULT_DEMO_PASSWORD;

    const result = await loginAndSetSessionCookie(email, password);

    if (!result.ok) {
        return Response.json({ error: "The demo account is unavailable" }, { status: 401 });
    }

    return Response.json({ ok: true });
}
