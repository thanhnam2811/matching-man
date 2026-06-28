import { cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/api";

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as {
        email?: string;
        password?: string;
        name?: string;
        organizationName?: string;
    } | null;

    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
        return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: body?.name, organizationName: body?.organizationName }),
        cache: "no-store",
    });

    if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        const message =
            response.status === 409 ? "That email is already registered" : (detail?.error?.message ?? "Sign up failed");
        return Response.json({ error: message }, { status: response.status });
    }

    const { token } = (await response.json()) as { token: string };

    (await cookies()).set(TOKEN_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 12,
    });

    return Response.json({ ok: true });
}
