import { loginAndSetSessionCookie } from "@/lib/api";

/**
 * One-click demo login. Reads the shared demo account credentials from env vars
 * (server-side only) and signs the visitor in — no body required. The credentials
 * match the user seeded by `apps/api/scripts/seed-demo.mjs`.
 */
export async function POST() {
    const email = process.env.DEMO_ACCOUNT_EMAIL?.trim();
    const password = process.env.DEMO_ACCOUNT_PASSWORD;

    if (!email || !password) {
        return Response.json({ error: "The demo account is not configured" }, { status: 503 });
    }

    const result = await loginAndSetSessionCookie(email, password);

    if (!result.ok) {
        return Response.json({ error: "The demo account is unavailable" }, { status: 401 });
    }

    return Response.json({ ok: true });
}
