import { cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/api";

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
        return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store",
    });

    if (!response.ok) {
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
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

export async function DELETE() {
    (await cookies()).delete(TOKEN_COOKIE);
    return Response.json({ ok: true });
}
