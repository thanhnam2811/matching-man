import { demoHealth, isDemoEnabled } from "@/lib/demo";

// Lightweight liveness probe the demo board polls to detect cold starts.
export async function GET() {
    if (!(await isDemoEnabled())) {
        return Response.json({ ok: false, configured: false }, { status: 503 });
    }

    return Response.json({ ok: await demoHealth(), configured: true });
}
