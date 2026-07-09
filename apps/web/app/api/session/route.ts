import { cookies } from "next/headers";
import { loginAndSetSessionCookie, TOKEN_COOKIE } from "@/lib/api";

export async function POST(request: Request) {
    const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
        return Response.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = await loginAndSetSessionCookie(email, password);

    if (!result.ok) {
        return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    return Response.json({ ok: true });
}

export async function DELETE() {
    (await cookies()).delete(TOKEN_COOKIE);
    return Response.json({ ok: true });
}
