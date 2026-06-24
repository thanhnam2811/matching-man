import { cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/api";

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim();

    if (!token) {
        return Response.json({ error: "Token is required" }, { status: 400 });
    }

    // Validate the token against a guarded endpoint before persisting it.
    const probe = await fetch(`${API_BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    if (!probe.ok) {
        return Response.json({ error: "Invalid dashboard admin token" }, { status: 401 });
    }

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